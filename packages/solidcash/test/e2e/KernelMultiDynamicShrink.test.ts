import { compileStringMulti } from '@solidcash/solidc';
import { buildChunkCommitment } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('kernel multi-resource dynamic output layout', () => {
  it('preserves the second write when the first direct dynamic value shrinks', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IStore { function shrink() external; }
      contract Store {
        bytes public first;
        bytes public second;
        function seed(bytes memory a, bytes memory b) public {
          this.first = a;
          this.second = b;
        }
        function shrink() public {
          this.first = hex"01";
          this.second = hex"02";
        }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store) public {
          IStore(store).shrink();
          this.count += 1;
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7c), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store);
    await store.call.seed(new Uint8Array(121).fill(0x41), Uint8Array.of(0x42)).send();
    const before = await store.getFullState();
    expect(before.dynamicChunkUtxos?.first).toHaveLength(2);
    expect(before.dynamicChunkUtxos?.second).toHaveLength(1);

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller.proxy, executionArtifact: caller.implementation.inner.artifact,
          executor: caller.implementation, functionName: 'run', args: [store.inner.lockingBytecode] },
        { contract: store, functionName: 'shrink', args: [], callsiteId: 0 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await composition.send();
    const state = await store.getState();
    expect(state.first).toEqual(Uint8Array.of(0x01));
    expect(state.second).toEqual(Uint8Array.of(0x02));
    const after = await store.getFullState();
    expect(after.dynamicChunkUtxos?.first).toHaveLength(1);
    expect(after.dynamicChunkUtxos?.second).toHaveLength(1);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 180_000);

  it('preserves both direct dynamic writes when the first in-place value shrinks', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      contract Store {
        bytes public first;
        bytes public second;
        function seed(bytes memory a, bytes memory b) public {
          this.first = a;
          this.second = b;
        }
        function shrink() public {
          this.first = hex"01";
          this.second = hex"02";
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7d), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    await store.call.seed(new Uint8Array(121).fill(0x41), Uint8Array.of(0x42)).send();
    const before = await store.getFullState();
    expect(before.dynamicChunkUtxos?.first).toHaveLength(2);
    expect(before.dynamicChunkUtxos?.second).toHaveLength(1);

    await store.call.shrink().send();
    const state = await store.getState();
    expect(state.first).toEqual(Uint8Array.of(0x01));
    expect(state.second).toEqual(Uint8Array.of(0x02));
    const after = await store.getFullState();
    expect(after.dynamicChunkUtxos?.first).toHaveLength(1);
    expect(after.dynamicChunkUtxos?.second).toHaveLength(1);
  }, 180_000);

  it('rebases a later direct participant dynamic-write output witness', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IStore { function write(bytes memory value) external; }
      contract Store {
        bytes public note;
        function write(bytes memory value) public { this.note = value; }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address store, bytes memory value) public {
          IStore(store).write(value);
          this.count += 1;
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7e), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const store = await getContractFactory(artifacts.Store, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store);

    const value = Uint8Array.of(0x41, 0x42, 0x43);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller.proxy, executionArtifact: caller.implementation.inner.artifact,
          executor: caller.implementation, functionName: 'run', args: [store.inner.lockingBytecode, value] },
        { contract: store, functionName: 'write', args: [value], callsiteId: 0 },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const storeInputIndex = builder.inputs.findIndex((input) => input.token?.category === store.categoryId
      && input.token.nft?.capability === 'minting');
    expect(storeInputIndex).toBeGreaterThan(0);
    const storeInput = builder.inputs[storeInputIndex];
    const routeUnlocker = storeInput?.unlocker as {
      abiFunction?: { inputs: readonly { name: string }[] };
      params?: readonly unknown[];
    } | undefined;
    const witnessIndex = routeUnlocker?.abiFunction?.inputs.findIndex((input) =>
      input.name === '__internal__dynamicChunkOutputBase') ?? -1;
    expect(witnessIndex).toBeGreaterThanOrEqual(0);
    const witness = routeUnlocker?.params?.[witnessIndex];
    expect(typeof witness).toBe('bigint');
    expect(witness).toBeGreaterThan(0n);
    expect(builder.outputs[Number(witness)]?.token?.category).toBe(store.categoryId);
    expect(builder.outputs[Number(witness)]?.token?.nft?.capability).toBe('mutable');
    expect(builder.outputs[Number(witness)]?.token?.nft?.commitment).toBe(buildChunkCommitment(0, value));
    expect(messageBusVmAccepts(builder)).toBe(true);
  }, 180_000);
});
