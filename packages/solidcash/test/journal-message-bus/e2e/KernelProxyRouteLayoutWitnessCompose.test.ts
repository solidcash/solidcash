import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('kernel proxy route layout witness compose', () => {
  it('relocates two collection predecessor witnesses on a proxy implementation route', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x57), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const counterArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Counter() {
        int public count;
        function bump() public { this.count = this.count + 1; }
      }`, KERNEL);
    const counterBase = new Contract(counterArtifact, [], { provider });
    const counterSetup = await setupStatefulUtxos(
      provider, counterBase, counterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(
      counterBase.withCategory(hexToBin(counterSetup.categoryId)), counterSetup.categoryId,
    );

    const implementationArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function bump() external; }
      contract Coordinator() {
        mapping(int => int) left;
        mapping(int => int) right;
        function seed() public { this.left[2] = 10; this.right[2] = 20; }
        function poke(address counter, int value) public {
          this.left[3] = value;
          this.right[3] = value + 1;
          ICounter(counter).bump();
        }
      }`, KERNEL);
    const delegate = implementationArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });
    const predOutNames = delegate.messageBus!.route.inputs
      .map((input) => input.name)
      .filter((name) => /^__internal__vmapBatchPredOut_\d+$/.test(name));
    expect(predOutNames.length).toBeGreaterThanOrEqual(2);

    const deployed = await upgrades.deployProxy(
      getContractFactory(implementationArtifact, signer), [],
    );
    deployed.implementation._registerResolvedExternal('ICounter', counter);
    await expect((deployed as any).seed().send()).resolves.toBeDefined();

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICoordinator { function poke(address counter, int value) external; }
      contract Caller() {
        function trigger(address coordinator, address counter, int value) public {
          ICoordinator(coordinator).poke(counter, value);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('ICoordinator', deployed.proxy);
    const callerCallsiteId = callerArtifact.abi.find((entry) => entry.name === 'trigger')!
      .externalCalls!.find((call) => call.functionName === 'poke')!.callsiteId!;

    const callsiteId = delegate.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'bump')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'trigger',
        args: [deployed.proxy.inner.lockingBytecode, counter.inner.lockingBytecode, 5n],
      }, {
        contract: deployed.proxy,
        functionName: 'poke',
        args: [counter.inner.lockingBytecode, 5n],
        callsiteId: callerCallsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: counter,
        functionName: 'bump',
        args: [],
        callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address
      && input.unlocker.abiFunction.name === delegate.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThan(0);
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toBeDefined();
    expect((await counter.getState()).count).toBe(1n);
  }, 300_000);

  it('settles two distinct literal keys of one proxy-owned mapping', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x58), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const counterArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Counter() {
        int public count;
        function bump() public { this.count = this.count + 1; }
      }`, KERNEL);
    const counterBase = new Contract(counterArtifact, [], { provider });
    const counterSetup = await setupStatefulUtxos(
      provider, counterBase, counterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(
      counterBase.withCategory(hexToBin(counterSetup.categoryId)), counterSetup.categoryId,
    );

    const implementationArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function bump() external; }
      contract Coordinator() {
        mapping(int => int) balances;
        function seed() public { this.balances[3] = 10; }
        function poke(address counter, int value) public {
          this.balances[3] = value;
          this.balances[4] = value + 1;
          ICounter(counter).bump();
        }
      }`, KERNEL);
    const delegate = implementationArtifact.delegateArtifact!;
    const pokeHandler = delegate.messageBus?.handlers.find((handler) => handler.name === 'poke');
    expect(pokeHandler)
      .toMatchObject({ eligible: true });
    expect(pokeHandler?.batchKeyWitnesses?.map((witness) => witness.expressionLabel))
      .toEqual(['const:3', 'const:4']);
    expect(new Set(pokeHandler?.physicalEntrySlots).size).toBe(2);
    const deployed = await upgrades.deployProxy(
      getContractFactory(implementationArtifact, signer), [],
    );
    deployed.implementation._registerResolvedExternal('ICounter', counter);
    await expect((deployed as any).seed().send()).resolves.toBeDefined();

    const callsiteId = delegate.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'bump')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [counter.inner.lockingBytecode, 5n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: counter,
        functionName: 'bump',
        args: [],
        callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toBeDefined();
    expect((await counter.getState()).count).toBe(1n);
    const entries = await deployed.proxy.getEntries('balances');
    const bySlot = new Map(entries.map((entry) => [
      entry.slot === undefined ? '' : binToHex(entry.slot), entry.value,
    ]));
    expect(bySlot.get(binToHex(keyToSlot(bigIntToVmNumber(3n))))).toBe(5n);
    expect(bySlot.get(binToHex(keyToSlot(bigIntToVmNumber(4n))))).toBe(6n);
  }, 300_000);

  it('settles two distinct parameter-derived keys of one proxy-owned mapping', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x59), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const counterArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Counter() {
        int public count;
        function bump() public { this.count = this.count + 1; }
      }`, KERNEL);
    const counterBase = new Contract(counterArtifact, [], { provider });
    const counterSetup = await setupStatefulUtxos(
      provider, counterBase, counterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(
      counterBase.withCategory(hexToBin(counterSetup.categoryId)), counterSetup.categoryId,
    );

    const implementationArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function bump() external; }
      contract Coordinator() {
        mapping(int => int) balances;
        function seed() public { this.balances[8] = 10; }
        function poke(address counter, int base, int value) public {
          this.balances[base + 1] = value;
          this.balances[base + 2] = value + 1;
          ICounter(counter).bump();
        }
      }`, KERNEL);
    const delegate = implementationArtifact.delegateArtifact!;
    const pokeHandler = delegate.messageBus?.handlers.find((handler) => handler.name === 'poke');
    expect(pokeHandler).toMatchObject({ eligible: true });
    expect(pokeHandler?.batchKeyWitnesses?.map((witness) => witness.expressionLabel))
      .toEqual(['binop:+(id:base,lit:1)', 'binop:+(id:base,lit:2)']);
    expect(new Set(pokeHandler?.physicalEntrySlots).size).toBe(2);
    const deployed = await upgrades.deployProxy(
      getContractFactory(implementationArtifact, signer), [],
    );
    deployed.implementation._registerResolvedExternal('ICounter', counter);
    await expect((deployed as any).seed().send()).resolves.toBeDefined();

    const callsiteId = delegate.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'bump')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [counter.inner.lockingBytecode, 7n, 5n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: counter,
        functionName: 'bump',
        args: [],
        callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toBeDefined();
    expect((await counter.getState()).count).toBe(1n);
    const entries = await deployed.proxy.getEntries('balances');
    const bySlot = new Map(entries.map((entry) => [
      entry.slot === undefined ? '' : binToHex(entry.slot), entry.value,
    ]));
    expect(bySlot.get(binToHex(keyToSlot(bigIntToVmNumber(8n))))).toBe(5n);
    expect(bySlot.get(binToHex(keyToSlot(bigIntToVmNumber(9n))))).toBe(6n);
  }, 300_000);

  it('settles commutative parameter-derived aliases as one proxy-owned entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5a), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const counterArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Counter() {
        int public count;
        function bump() public { this.count = this.count + 1; }
      }`, KERNEL);
    const counterBase = new Contract(counterArtifact, [], { provider });
    const counterSetup = await setupStatefulUtxos(
      provider, counterBase, counterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(
      counterBase.withCategory(hexToBin(counterSetup.categoryId)), counterSetup.categoryId,
    );

    const implementationArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function bump() external; }
      contract Coordinator() {
        mapping(int => int) balances;
        function seed() public { this.balances[8] = 10; }
        function poke(address counter, int base, int value) public {
          this.balances[base + 1] = value;
          this.balances[1 + base] = value + 1;
          ICounter(counter).bump();
        }
      }`, KERNEL);
    const delegate = implementationArtifact.delegateArtifact!;
    const pokeHandler = delegate.messageBus?.handlers.find((handler) => handler.name === 'poke');
    expect(pokeHandler).toMatchObject({ eligible: true });
    expect(new Set(pokeHandler?.physicalEntrySlots).size).toBe(1);
    const deployed = await upgrades.deployProxy(
      getContractFactory(implementationArtifact, signer), [],
    );
    deployed.implementation._registerResolvedExternal('ICounter', counter);
    await expect((deployed as any).seed().send()).resolves.toBeDefined();

    const callsiteId = delegate.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'bump')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [counter.inner.lockingBytecode, 7n, 5n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: counter,
        functionName: 'bump',
        args: [],
        callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toBeDefined();
    expect((await counter.getState()).count).toBe(1n);
    const entries = await deployed.proxy.getEntries('balances');
    expect(entries).toHaveLength(1);
    expect(binToHex(entries[0].slot!)).toBe(binToHex(keyToSlot(bigIntToVmNumber(8n))));
    expect(entries[0].value).toBe(6n);
  }, 300_000);
});
