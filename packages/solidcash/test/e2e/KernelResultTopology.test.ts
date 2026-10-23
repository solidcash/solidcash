import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
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
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
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

  it.each([
    ['one outer occurrence', [7n], 15n, 2n],
    ['two outer occurrences', [7n, 11n], 38n, 4n],
  ] as const)('composes reached inner-loop rows for %s', async (_title, values, total, count) => {
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
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
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
    const receipt = await coordinator.call.run(values).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await sink.getState()).total).toBe(total);
    expect((await sink.getState()).count).toBe(count);
    expect((await router.getState()).count).toBe(1n);
    expect((await coordinator.getState()).count).toBe(1n);
  }, 180_000);

  it.each([
    ['refreshes inner call arguments from one outer producer result', [7n], 17n, 2n],
    ['pairs repeated outer producer results with their inner call rows', [7n, 11n], 42n, 4n],
  ] as const)('%s', async (_title, values, total, count) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        uint public count;
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint base = IReader(reader).read(values[i]);
            for (uint j = 0; j < 2; j++) {
              ISink(sink).record(base + j);
            }
          }
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    const receipt = await router.call.route(values).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await sink.getState()).total).toBe(total);
    expect((await sink.getState()).count).toBe(count);
    expect((await router.getState()).count).toBe(1n);
  }, 180_000);

  it('keeps separate identical loop domains in source order', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) { ILeft(left).record(values[i]); }
          for (uint i = 0; i < values.length; i++) { IRight(right).record(values[i] + 10); }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const sourceCalls = artifacts.Router.abi.find((entry) => entry.name === 'route')?.externalCalls;
    expect(sourceCalls).toHaveLength(2);
    expect(sourceCalls?.every((call) => call.iterationDomain !== undefined)).toBe(true);
    expect(sourceCalls?.[0].iterationDomain?.sourceLoopId).not.toBe(
      sourceCalls?.[1].iterationDomain?.sourceLoopId,
    );
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x77), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    const receipt = await router.call.route([7n, 11n]).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await left.getState()).total).toBe(18n);
    expect((await left.getState()).count).toBe(2n);
    expect((await right.getState()).total).toBe(38n);
    expect((await right.getState()).count).toBe(2n);
  }, 180_000);

  it('interleaves a sibling effect before a repeated producer result', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface IAudit { function record(uint value) external; }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public view returns (uint) { return key; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address audit, address reader, address sink) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            IAudit(audit).record(values[i] + 100);
            uint observed = IReader(reader).read(values[i]);
            ISink(sink).record(observed + 1);
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const sourceCalls = artifacts.Router.abi.find((entry) => entry.name === 'route')?.externalCalls;
    expect(sourceCalls).toHaveLength(3);
    expect(sourceCalls?.every((call) => call.iterationDomain || call.nestedIterationDomains)).toBe(true);
    expect(new Set(sourceCalls?.map((call) => call.iterationDomain?.sourceLoopId
      ?? call.nestedIterationDomains?.[0].sourceLoopId)).size).toBe(1);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x79), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const audit = await getContractFactory(artifacts.Sink, signer).deploy();
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      audit.inner.lockingBytecode, reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('IAudit', audit);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route([7n, 11n]).send();
    expect((await audit.getState()).total).toBe(218n);
    expect((await audit.getState()).count).toBe(2n);
    expect((await sink.getState()).total).toBe(20n);
    expect((await sink.getState()).count).toBe(2n);
  }, 180_000);

  it.each([
    ['interleaves two inner-loop callsites for one producer occurrence', [7n], 17n, 37n, 2n],
    ['interleaves two inner-loop callsites for two producer occurrences', [7n, 11n], 42n, 82n, 4n],
  ] as const)('%s', async (_title, values, leftTotal, rightTotal, count) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint base = IReader(reader).read(values[i]);
            for (uint j = 0; j < 2; j++) {
              ILeft(left).record(base + j);
              IRight(right).record(base + j + 10);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const sourceCalls = artifacts.Router.abi.find((entry) => entry.name === 'route')?.externalCalls;
    expect(sourceCalls).toHaveLength(3);
    expect(sourceCalls?.[1].nestedIterationDomains?.map((domain) => domain.sourceLoopId)).toEqual(
      sourceCalls?.[2].nestedIterationDomains?.map((domain) => domain.sourceLoopId),
    );
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7a), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    await router.call.route(values).send();
    expect((await left.getState()).total).toBe(leftTotal);
    expect((await left.getState()).count).toBe(count);
    expect((await right.getState()).total).toBe(rightTotal);
    expect((await right.getState()).count).toBe(count);
  }, 180_000);

  it('preserves scalar calls around a repeated multi-call loop', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IBefore { function record(uint value) external; }
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      interface IAfter { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address before, address reader, address sink, address after) {
        function route(uint[] memory values) public {
          IBefore(before).record(1);
          for (uint i = 0; i < values.length; i++) {
            uint observed = IReader(reader).read(values[i]);
            ISink(sink).record(observed + 1);
          }
          IAfter(after).record(2);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7b), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const before = await getContractFactory(artifacts.Sink, signer).deploy();
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const after = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      before.inner.lockingBytecode, reader.inner.lockingBytecode,
      sink.inner.lockingBytecode, after.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IBefore', before);
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    router._registerResolvedExternal('IAfter', after);
    await router.call.route([7n, 11n]).send();
    expect((await before.getState()).total).toBe(1n);
    expect((await before.getState()).count).toBe(1n);
    expect((await sink.getState()).total).toBe(20n);
    expect((await sink.getState()).count).toBe(2n);
    expect((await after.getState()).total).toBe(2n);
    expect((await after.getState()).count).toBe(1n);
  }, 180_000);

  it('orders skipped conditional rows by source loop iteration', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            if (i != 1) { ILeft(left).record(values[i]); }
            IRight(right).record(values[i] + 10);
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7c), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    await router.call.route([7n, 11n, 13n]).send();
    expect((await left.getState()).total).toBe(20n);
    expect((await left.getState()).count).toBe(2n);
    expect((await right.getState()).total).toBe(61n);
    expect((await right.getState()).count).toBe(3n);
  }, 180_000);

  it('selects a conditional row from its own producer occurrence', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint observed = IReader(reader).read(values[i]);
            if (observed != 12) { ILeft(left).record(observed); }
            IRight(right).record(observed + 10);
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7d), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    await router.call.route([7n, 11n, 13n]).send();
    expect((await left.getState()).total).toBe(22n);
    expect((await left.getState()).count).toBe(2n);
    expect((await right.getState()).total).toBe(64n);
    expect((await right.getState()).count).toBe(3n);
  }, 180_000);

  it('orders skipped nested rows under repeated producer results', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint base = IReader(reader).read(values[i]);
            for (uint j = 0; j < 3; j++) {
              if (j != 1) { ILeft(left).record(base + j); }
              IRight(right).record(base + j + 10);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7e), provider);
    for (let index = 0; index < 28; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    await router.call.route([7n, 11n]).send();
    expect((await left.getState()).total).toBe(44n);
    expect((await left.getState()).count).toBe(4n);
    expect((await right.getState()).total).toBe(126n);
    expect((await right.getState()).count).toBe(6n);
  }, 180_000);

  it.each([
    ['one producer result as its own inner-loop bound', [2n], 5n, 25n, 2n],
    ['two producer results as their own inner-loop bounds', [1n, 2n], 6n, 36n, 3n],
  ] as const)('uses %s', async (_title, values, leftTotal, rightTotal, count) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ILeft { function record(uint value) external; }
      interface IRight { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address left, address right) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint bound = IReader(reader).read(values[i]);
            for (uint j = 0; j < bound; j++) {
              ILeft(left).record(bound + j);
              IRight(right).record(bound + j + 10);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const sourceCalls = artifacts.Router.abi.find((entry) => entry.name === 'route')?.externalCalls;
    expect(sourceCalls?.[1].nestedIterationDomains).toHaveLength(2);
    expect(sourceCalls?.[2].nestedIterationDomains).toHaveLength(2);
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7f), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const left = await getContractFactory(artifacts.Sink, signer).deploy();
    const right = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, left.inner.lockingBytecode, right.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', right);
    await router.call.route(values).send();
    expect((await left.getState()).total).toBe(leftTotal);
    expect((await left.getState()).count).toBe(count);
    expect((await right.getState()).total).toBe(rightTotal);
    expect((await right.getState()).count).toBe(count);
  }, 180_000);

  it('uses a scalar producer result as a repeated call bound', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        function route(uint value) public {
          uint bound = IReader(reader).read(value);
          for (uint j = 0; j < bound; j++) { ISink(sink).record(j + 1); }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const sourceCalls = artifacts.Router.abi.find((entry) => entry.name === 'route')?.externalCalls;
    expect(sourceCalls?.[1].iterationDomain).toBeDefined();
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x80), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route(2n).send();
    expect((await sink.getState()).total).toBe(3n);
    expect((await sink.getState()).count).toBe(2n);
  }, 180_000);

  it('combines the current outer coordinate with its producer-bound inner count', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            uint observed = IReader(reader).read(values[i]);
            uint bound = observed + i;
            for (uint j = 0; j < bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x81), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route([1n, 2n]).send();
    expect((await sink.getState()).total).toBe(7n);
    expect((await sink.getState()).count).toBe(4n);
  }, 180_000);

  it('does not use stale state for a loop bound written earlier in each outer iteration', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        uint public bound;
        function route(uint[] memory values) public {
          for (uint i = 0; i < values.length; i++) {
            this.bound = values[i];
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x82), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route([1n, 2n]).send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('uses each producer result stored in state as its inner loop bound', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        uint public bound;
        function route() public {
          for (uint i = 0; i < 2; i++) {
            this.bound = IReader(reader).read(i);
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x84), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('uses a state bound assigned on both branches of each outer iteration', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        uint public bound;
        function route() public {
          for (uint i = 0; i < 2; i++) {
            if (i == 0) { this.bound = 1; } else { this.bound = 2; }
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x85), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('uses a conditional producer result assigned to the next inner-loop bound', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        uint public bound;
        function route() public {
          for (uint i = 0; i < 2; i++) {
            if (i == 1) { this.bound = IReader(reader).read(i); }
            else { this.bound = 1; }
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x86), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('selects each branch-local producer on one physical reader for the inner-loop bound', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILeft { function read(uint key) external view returns (uint); }
      interface IRight { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Left {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address left, address right, address sink) {
        uint public bound;
        function route() public {
          for (uint i = 0; i < 2; i++) {
            if (i == 0) { this.bound = ILeft(left).read(i); }
            else { this.bound = IRight(right).read(i); }
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x87), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const left = await getContractFactory(artifacts.Left, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      left.inner.lockingBytecode, left.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('ILeft', left);
    router._registerResolvedExternal('IRight', left);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('selects a skipped conditional producer target from its source array coordinate', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract ReaderA {
        function read(uint key) public pure returns (uint) { return key + 10; }
      }
      contract ReaderB {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        uint public bound;
        function route(address[] memory readers) public {
          for (uint i = 0; i < 2; i++) {
            if (i == 1) { this.bound = IReader(readers[i]).read(i); }
            else { this.bound = 1; }
            for (uint j = 0; j < this.bound; j++) { ISink(sink).record(j + 1); }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x88), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const readerA = await getContractFactory(artifacts.ReaderA, signer).deploy();
    const readerB = await getContractFactory(artifacts.ReaderB, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('IReader', readerA);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route([readerA.inner.lockingBytecode, readerB.inner.lockingBytecode]).send();
    expect((await router.getState()).bound).toBe(2n);
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(3n);
  }, 180_000);

  it('routes two sparse producer returns to their own downstream rows', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        function route() public {
          for (uint i = 0; i < 3; i++) {
            if (i != 1) {
              uint observed = IReader(reader).read(i);
              ISink(sink).record(observed);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x89), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await sink.getState()).total).toBe(4n);
    expect((await sink.getState()).count).toBe(2n);
  }, 180_000);

  it('selects a downstream branch from the later sparse producer return', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        function route() public {
          for (uint i = 0; i < 3; i++) {
            if (i != 1) {
              uint observed = IReader(reader).read(i);
              if (observed > 1) { ISink(sink).record(observed); }
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x8a), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await sink.getState()).total).toBe(3n);
    expect((await sink.getState()).count).toBe(1n);
  }, 180_000);

  it('removes a speculative sparse branch after observing the producer return', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      interface ISink { function record(uint value) external; }
      contract Reader {
        function read(uint key) public pure returns (uint) { return key + 1; }
      }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address reader, address sink) {
        function route() public {
          for (uint i = 0; i < 3; i++) {
            if (i != 1) {
              uint observed = IReader(reader).read(i);
              if (observed < 2) { ISink(sink).record(observed); }
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x8b), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const reader = await getContractFactory(artifacts.Reader, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(
      reader.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    router._registerResolvedExternal('IReader', reader);
    router._registerResolvedExternal('ISink', sink);
    await router.call.route().send();
    expect((await sink.getState()).total).toBe(1n);
    expect((await sink.getState()).count).toBe(1n);
  }, 180_000);

  it('refuses a changing inner state bound before broadcasting any row', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        uint public bound;
        function route() public {
          for (uint i = 0; i < 1; i++) {
            this.bound = 3;
            for (uint j = 0; j < this.bound; j++) {
              this.bound = this.bound - 1;
              ISink(sink).record(j + 1);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x83), provider);
    for (let index = 0; index < 16; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('ISink', sink);
    await expect(router.call.route().send()).rejects.toThrow(
      'messageBus: result-dependent loop has no compiler iteration domain',
    );
    expect((await router.getState()).bound).toBe(0n);
    expect((await sink.getState()).total).toBe(0n);
    expect((await sink.getState()).count).toBe(0n);
  }, 180_000);

  it('refuses an unproven later loop before broadcasting any earlier row', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function record(uint value) external; }
      contract Sink {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Router(address sink) {
        function route(uint[] memory values) public {
          uint bound = values.length;
          for (uint i = 0; i < values.length; i++) {
            bound = 1;
            ISink(sink).record(values[i]);
          }
          for (uint j = 0; j < bound; j++) { ISink(sink).record(values[j] + 10); }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x78), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const router = await getContractFactory(artifacts.Router, signer).deploy(sink.inner.lockingBytecode);
    router._registerResolvedExternal('ISink', sink);
    await expect(router.call.route([7n, 11n]).send()).rejects.toThrow(
      'messageBus: result-dependent loop has no compiler iteration domain',
    );
    expect((await sink.getState()).total).toBe(0n);
    expect((await sink.getState()).count).toBe(0n);
  }, 180_000);
});
