import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { decodeEvmScalarReturn } from '../../../src/stateful/StatefulContract.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel function-pointer BCH VM', () => {
  it('decodes both finite self targets in a multi-return and rejects a forged pointer field', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface Sink {
        function touch() external;
      }
      contract C {
        function target(uint value) external pure returns (uint) { return value + 1; }
        function alternate(uint value) external pure returns (uint) { return value + 2; }
        function pointer(address sink, bool choose) public
          returns (function(uint) external returns (uint), uint) {
          Sink(sink).touch();
          return (choose ? this.target : this.alternate, 23);
        }
      }
      contract Leaf {
        function touch() public { require(true); }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
    });
    const artifact = artifacts.C;
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pointer'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'int256' }, { type: 'uint256' }] });
    const connect = async (selected: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(selected, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, selected.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const contract = await connect(artifact);
    const leaf = await connect(artifacts.Leaf);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = (choose: boolean): ReturnType<typeof messageBus.compose> => messageBus.compose({
      preparedCalls: [
        { contract, functionName: 'pointer', args: [leaf.inner.lockingBytecode, choose] },
        { contract: leaf, functionName: 'touch', args: [] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition(true).build();
    expect(vmAccepts(canonical)).toBe(true);
    const returnOutput = canonical.outputs.find((output) => output.token?.category === contract.categoryId
      && output.token.nft?.capability === 'none');
    if (!returnOutput?.token?.nft) throw new Error('test could not locate the function-id return output');
    const canonicalOuter = decodeAuthenticationInstructions(hexToBin(returnOutput.token.nft.commitment));
    if (canonicalOuter.length !== 1 || !('data' in canonicalOuter[0])
      || canonicalOuter[0].data.length !== 64) {
      throw new Error('return output is not one canonical two-word result vector');
    }
    const decodedPointer = decodeEvmScalarReturn(canonicalOuter[0].data.slice(0, 32), 'int256');
    const decodedValue = decodeEvmScalarReturn(canonicalOuter[0].data.slice(32), 'uint256');
    expect(typeof decodedPointer).toBe('bigint');
    expect(decodedValue).toBe(23n);

    const alternate = await composition(false).build();
    expect(vmAccepts(alternate)).toBe(true);
    const alternateReturn = alternate.outputs.find((output) => output.token?.category === contract.categoryId
      && output.token.nft?.capability === 'none');
    if (!alternateReturn?.token?.nft) throw new Error('test could not locate the alternate return output');
    const alternateOuter = decodeAuthenticationInstructions(hexToBin(alternateReturn.token.nft.commitment));
    if (alternateOuter.length !== 1 || !('data' in alternateOuter[0])
      || alternateOuter[0].data.length !== 64) {
      throw new Error('alternate return output is not one canonical two-word result vector');
    }
    const alternatePointer = decodeEvmScalarReturn(alternateOuter[0].data.slice(0, 32), 'int256');
    expect(typeof alternatePointer).toBe('bigint');
    expect(alternatePointer).not.toBe(decodedPointer);
    expect(decodeEvmScalarReturn(alternateOuter[0].data.slice(32), 'uint256')).toBe(23n);

    const hostile = await composition(true).build();
    const hostileReturn = hostile.outputs.find((output) => output.token?.category === contract.categoryId
      && output.token.nft?.capability === 'none');
    if (!hostileReturn?.token?.nft) throw new Error('test could not locate the hostile return output');
    const commitment = hexToBin(hostileReturn.token.nft.commitment);
    const outer = decodeAuthenticationInstructions(commitment);
    if (outer.length !== 1 || !('data' in outer[0])) throw new Error('return output is not one bytes field');
    if (outer[0].data.length !== 64) throw new Error('return vector is not a two-word tuple');
    const forgedVector = outer[0].data.slice();
    // Substitute the other valid member of the proven finite set. The branch chose `target`, so even an otherwise
    // admissible local function ID must fail when it is not the exact runtime result.
    forgedVector.set(alternateOuter[0].data.slice(0, 32), 0);
    outer[0] = { ...outer[0], data: forgedVector };
    hostileReturn.token.nft.commitment = binToHex(encodeAuthenticationInstructions(outer));
    expect(vmAccepts(hostile)).toBe(false);
  }, 120_000);

  it('dispatches a received pointer to the runtime-selected callee and selector', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      contract Sink {
        uint value;
        function inc() public { value = value + 1; require(true); }
        function dec() public { value = value - 1; require(true); }
      }
      contract SinkAlt {
        uint value;
        function inc() public { value = value + 2; require(true); }
        function dec() public { value = value - 2; require(true); }
      }
      contract Store {
        function() external stored;
        uint calls;
        function save(function() external next) public { stored = next; require(true); }
        function run() public { stored(); calls = calls + 1; require(true); }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
      suppressWarnings: true,
    });
    expect(artifacts.Store.messageBus?.available).toBe(true);
    expect(artifacts.SinkAlt.bytecode).not.toBe(artifacts.Sink.bytecode);
    const inc = hexToBin(artifacts.Sink.abi.find((entry) => entry.name === 'inc')!.selector!);
    const dec = hexToBin(artifacts.SinkAlt.abi.find((entry) => entry.name === 'dec')!.selector!);
    const connect = async (selected: Artifact, state: Record<string, unknown>): Promise<StatefulContract> => {
      const base = new Contract(selected, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, selected.stateLayout!, state, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const first = await connect(artifacts.Sink, { value: 5n });
    const second = await connect(artifacts.SinkAlt, { value: 10n });
    const store = await connect(artifacts.Store, {
      stored: hexToBin(first.inner.lockingBytecode), __fnsel_stored: inc, calls: 0n,
    });
    const compose = async (
      preparedCalls: Parameters<typeof messageBus.compose>[0]['preparedCalls'],
    ): Promise<ReturnType<typeof messageBus.compose>> => {
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        preparedCalls, funder, changeAddress: funder.unlocker.generateLockingBytecode(),
      });
    };
    await store.call.save(second.inner.lockingBytecode, dec).send();

    const callsiteId = artifacts.Store.abi.find((entry) => entry.name === 'run')!
      .externalCalls!.find((call) => call.fnPtrCall)!.callsiteId!;
    const wrongTarget = await compose([
      { contract: store, functionName: 'run', args: [] },
      { contract: first, functionName: 'inc', args: [], callsiteId },
    ]);
    await expect(wrongTarget.build()).rejects.toThrow(/BCH-2026 preflight failed/);

    const run = await compose([
      { contract: store, functionName: 'run', args: [] },
      { contract: second, functionName: 'dec', args: [], callsiteId },
    ]);
    expect(vmAccepts(await run.build())).toBe(true);
    await run.send();
    expect((await first.getState()).value).toBe(5n);
    expect((await second.getState()).value).toBe(8n);
    expect((await store.getState()).calls).toBe(1n);
  }, 120_000);

  it('dispatches a ternary interface receiver to either runtime-selected callee', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface ISink { function note(uint amount) external; }
      contract Sink {
        uint value;
        function note(uint amount) public { value = value + amount; require(true); }
      }
      contract SinkAlt {
        uint value;
        function note(uint amount) public { value = value + amount * 2; require(true); }
      }
      contract Router(ISink left, ISink right) {
        uint calls;
        function forward(bool choose, uint amount) public {
          (choose ? left : right).note(amount);
          calls = calls + 1;
          require(true);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
      suppressWarnings: true,
    });
    expect(artifacts.SinkAlt.bytecode).not.toBe(artifacts.Sink.bytecode);
    const connect = async (
      selected: Artifact, args: readonly unknown[], state: Record<string, unknown>,
    ): Promise<StatefulContract> => {
      const base = new Contract(selected, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, selected.stateLayout!, state, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const left = await connect(artifacts.Sink, [], { value: 5n });
    const right = await connect(artifacts.SinkAlt, [], { value: 10n });
    const router = await connect(artifacts.Router,
      [left.inner.lockingBytecode, right.inner.lockingBytecode], { calls: 0n });
    const compose = async (
      choose: boolean, target: StatefulContract,
    ): Promise<ReturnType<typeof messageBus.compose>> => {
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        preparedCalls: [
          { contract: router, functionName: 'forward', args: [choose, 2n] },
          { contract: target, functionName: 'note', args: [2n] },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
    };
    expect(vmAccepts(await (await compose(true, left)).build())).toBe(true);
    expect(vmAccepts(await (await compose(false, right)).build())).toBe(true);
    await expect((await compose(false, left)).build()).rejects.toThrow(/BCH-2026 preflight failed/);
  }, 120_000);

  it('composes a reached conditional function-pointer call by its compiler callsite', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      contract Sink {
        uint value;
        function dec() public { value = value - 1; require(true); }
      }
      contract Store {
        function() external stored;
        uint calls;
        function save(function() external next) public { stored = next; require(true); }
        function run(bool enabled) public {
          if (enabled) { stored(); }
          calls = calls + 1;
          require(true);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
      suppressWarnings: true,
    });
    const sinkBase = new Contract(artifacts.Sink, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, artifacts.Sink.stateLayout!, { value: 10n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );
    const storeBase = new Contract(artifacts.Store, [], { provider });
    const selector = hexToBin(artifacts.Sink.abi.find((entry) => entry.name === 'dec')!.selector!);
    const storeSetup = await setupStatefulUtxos(provider, storeBase, artifacts.Store.stateLayout!, {
      stored: hexToBin(sink.inner.lockingBytecode), __fnsel_stored: selector, calls: 0n,
    }, { saltContract: true });
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const call = artifacts.Store.abi.find((entry) => entry.name === 'run')!.externalCalls![0];
    expect(call).toMatchObject({ fnPtrCall: true, occurrence: 'conditional' });
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: store, functionName: 'run', args: [true] },
        { contract: sink, functionName: 'dec', args: [], callsiteId: call.callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(vmAccepts(await composition.build())).toBe(true);
    await composition.send();
    expect((await sink.getState()).value).toBe(9n);
    expect((await store.getState()).calls).toBe(1n);
  }, 120_000);

  it('omits an untaken pointer edge while settling an always-reached sibling', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface IAlways { function ping() external; }
      contract Always {
        uint hits;
        function ping() public { hits = hits + 1; require(true); }
      }
      contract Sink {
        uint value;
        function dec() public { value = value - 1; require(true); }
      }
      contract Store(address always) {
        function() external stored;
        uint calls;
        function save(function() external next) public { stored = next; require(true); }
        function run(bool enabled) public {
          IAlways(always).ping();
          if (enabled) { stored(); }
          calls = calls + 1;
          require(true);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
      suppressWarnings: true,
    });
    const connect = async (
      selected: Artifact, args: readonly unknown[], state: Record<string, unknown>,
    ): Promise<StatefulContract> => {
      const base = new Contract(selected, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, selected.stateLayout!, state, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const always = await connect(artifacts.Always, [], { hits: 0n });
    const sink = await connect(artifacts.Sink, [], { value: 10n });
    const selector = hexToBin(artifacts.Sink.abi.find((entry) => entry.name === 'dec')!.selector!);
    const store = await connect(artifacts.Store, [always.inner.lockingBytecode], {
      stored: hexToBin(sink.inner.lockingBytecode), __fnsel_stored: selector, calls: 0n,
    });
    const calls = artifacts.Store.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    const alwaysCall = calls.find((call) => call.functionName === 'ping')!;
    const pointerCall = calls.find((call) => call.fnPtrCall)!;
    expect(pointerCall).toMatchObject({ occurrence: 'conditional' });
    const compose = async (enabled: boolean): Promise<ReturnType<typeof messageBus.compose>> => {
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        preparedCalls: [
          { contract: store, functionName: 'run', args: [enabled] },
          { contract: always, functionName: 'ping', args: [], callsiteId: alwaysCall.callsiteId },
          ...(enabled ? [{ contract: sink, functionName: 'dec', args: [], callsiteId: pointerCall.callsiteId }] : []),
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
    };

    const untaken = await compose(false);
    expect(vmAccepts(await untaken.build())).toBe(true);
    await untaken.send();
    expect((await always.getState()).hits).toBe(1n);
    expect((await sink.getState()).value).toBe(10n);
    expect((await store.getState()).calls).toBe(1n);

    const taken = await compose(true);
    expect(vmAccepts(await taken.build())).toBe(true);
    await taken.send();
    expect((await always.getState()).hits).toBe(2n);
    expect((await sink.getState()).value).toBe(9n);
    expect((await store.getState()).calls).toBe(2n);
  }, 120_000);

  it('settles both owners and methods of a locally selected external pointer', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      interface IHandler { function inc() external; function dec() external; }
      contract Handler {
        int value;
        function inc() public { value = value + 1; require(true); }
        function dec() public { value = value - 1; require(true); }
      }
      contract Caller(address first, address second) {
        int calls;
        function run(bool up) public {
          function() external selected = up ? IHandler(first).inc : IHandler(second).dec;
          selected();
          calls = calls + 1;
          require(true);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      evmCompat: true,
      suppressWarnings: true,
    });
    expect(artifacts.Caller.messageBus?.route?.inputs.some(
      (input) => input.name === '__internal__graphEmissions',
    )).toBe(true);
    const connectHandler = async (value: bigint): Promise<StatefulContract> => {
      const base = new Contract(artifacts.Handler, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifacts.Handler.stateLayout!, { value }, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const first = await connectHandler(10n);
    const second = await connectHandler(20n);
    expect(first.inner.lockingBytecode).not.toBe(second.inner.lockingBytecode);
    const callerBase = new Contract(
      artifacts.Caller, [first.inner.lockingBytecode, second.inner.lockingBytecode], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, artifacts.Caller.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const callsiteId = artifacts.Caller.abi.find((entry) => entry.name === 'run')!.externalCalls![0].callsiteId!;
    const compose = async (
      up: boolean,
      target = up ? first : second,
      method = up ? 'inc' : 'dec',
    ): Promise<ReturnType<typeof messageBus.compose>> => {
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        preparedCalls: [
          { contract: caller, functionName: 'run', args: [up] },
          { contract: target, functionName: method, args: [], callsiteId },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });
    };

    const wrongOwner = await compose(true, second, 'inc');
    await expect(wrongOwner.build()).rejects.toThrow(/BCH-2026 preflight failed/);

    const increase = await compose(true);
    expect(vmAccepts(await increase.build())).toBe(true);
    await increase.send();
    expect((await first.getState()).value).toBe(11n);
    expect((await second.getState()).value).toBe(20n);
    expect((await caller.getState()).calls).toBe(1n);

    const decrease = await compose(false);
    expect(vmAccepts(await decrease.build())).toBe(true);
    await decrease.send();
    expect((await first.getState()).value).toBe(11n);
    expect((await second.getState()).value).toBe(19n);
    expect((await caller.getState()).calls).toBe(2n);

    await caller.run(true).withExternalCall(first, 'inc', []).send();
    expect((await first.getState()).value).toBe(12n);
    expect((await second.getState()).value).toBe(19n);
    expect((await caller.getState()).calls).toBe(3n);
  }, 120_000);
});
