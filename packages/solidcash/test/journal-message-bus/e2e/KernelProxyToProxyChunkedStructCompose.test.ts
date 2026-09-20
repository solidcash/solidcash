import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, messageBus, getContractFactory, upgrades, Signer,
} from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/**
 * proxy→foreign-proxy × chunked structs:
 * - Variable-width Item[] (string field) without a nested callsite has no inferred delegate variant
 *   (honest deployProxy admission fence).
 * - Fixed-width int[] with nested Probe (product shape that settles Item[] under deployProxy compose)
 *   settles dual-proxy Acc.poke→Store.append empty→first-write with ChunkNft mint.
 */
describe('kernel proxy → foreign-proxy chunked-struct under composition', () => {
  it('fences variable-width Item[] as non-delegate (no deployProxy Store)', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        struct Item { int amount; string label; bool active; }
        int hold;
        Item[] items;
        function initialize() public { this.hold = 0; }
        function append(int amount, string label) public {
          this.items.push();
          int id = this.items.length - 1;
          this.items[id].amount = amount;
          this.items[id].label = label;
          this.items[id].active = true;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((h) => h.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.delegateArtifact).toBeUndefined();
  });

  it('settles deployProxy poke→deployProxy Store int[] append under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Store() {
        int hold;
        int[] items;
        function initialize() public { this.hold = 0; }
        function append(address probe, int amount) public {
          this.items.push(amount);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.delegateArtifact).toBeDefined();
    expect(storeArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'append'))
      .toMatchObject({ eligible: true });

    const store = await upgrades.deployProxy(getContractFactory(storeArtifact, signer), []);
    store.implementation._registerResolvedExternal('IProbe', probe);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(address probe, int amount) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address store, address probe, int amount) public {
          IStore(store).append(probe, amount);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = callerArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((h) => h.name === 'poke'))
      .toMatchObject({ eligible: true });

    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IStore', store.proxy);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();
    const probeCallsite = storeArtifact.delegateArtifact!.abi.find((entry) => entry.name === 'append')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(probeCallsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [store.proxy.inner.lockingBytecode, probe.inner.lockingBytecode, 7n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: store.proxy,
        functionName: 'append',
        args: [probe.inner.lockingBytecode, 7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: store.implementation.inner.artifact,
        executor: store.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: probeCallsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await store.proxy.getState()).items).toEqual([7n]);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
