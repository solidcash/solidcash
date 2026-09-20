import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  messageBus, getContractFactory, upgrades, Signer,
} from '../../../src/index.js';
import { createBareP2pkhFeeFunder } from '../../test-util.js';
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
 * - Variable-width Item[] (string field) is message-bus eligible but has no inferred delegate variant
 *   (honest deployProxy admission fence).
 * - Fixed-width int[] is deployProxy-eligible; dual-proxy Acc.poke→Store.append under compose fails
 *   closed on chunk OP_VERIFY — same honest fence class as KernelProxyToProxyBytesCompose.
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

  it('refuses deployProxy poke→deployProxy Store int[] append under compose (honest fence)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int hold;
        int[] items;
        function initialize() public { this.hold = 0; }
        function append(int amount) public {
          this.items.push(amount);
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.delegateArtifact).toBeDefined();
    expect(storeArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'append'))
      .toMatchObject({ eligible: true });

    const store = await upgrades.deployProxy(getContractFactory(storeArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(int amount) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address store, int amount) public {
          IStore(store).append(amount);
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

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [store.proxy.inner.lockingBytecode, 7n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: store.proxy,
        functionName: 'append',
        args: [7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: store.implementation.inner.artifact,
        executor: store.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    // Measured: dual-proxy int[] chunk path OP_VERIFY (~input 70).
    await expect(composition.send()).rejects.toThrow(/OP_VERIFY|preflight failed/);
  }, 300_000);
});
