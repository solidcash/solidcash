import { hexToBin } from '@bitauth/libauth';
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
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/**
 * proxy→foreign × chunked structs: deployProxy Acc.poke → foreign Store.append (Item[] push) under
 * compose+executionArtifact. Empty→first-element settles (positive chunk-backed struct array mint).
 */
describe('kernel proxy × foreign chunked struct under composition', () => {
  it('settles deployProxy poke→Store empty Item[]→append under compose with executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x74), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        struct Item { int amount; string label; bool active; }
        Item[] items;
        function append(int amount, string label) public {
          this.items.push();
          int id = this.items.length - 1;
          this.items[id].amount = amount;
          this.items[id].label = label;
          this.items[id].active = true;
          require(true);
        }
        function check(int id, int amount, string label, bool active) public {
          require(this.items[id].amount == amount);
          require(this.items[id].label == label);
          require(this.items[id].active == active);
        }
        function checkLength(int expected) public {
          require(this.items.length == expected);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(int amount, string label) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address store, int amount, string label) public {
          IStore(store).append(amount, label);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IStore', store);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 7n, 'first'],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: store,
        functionName: 'append',
        args: [7n, 'first'],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    await expect(store.call.checkLength(1n).send()).resolves.toBeDefined();
    await expect(store.call.check(0n, 7n, 'first', true).send()).resolves.toBeDefined();
    expect((await deployed.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
