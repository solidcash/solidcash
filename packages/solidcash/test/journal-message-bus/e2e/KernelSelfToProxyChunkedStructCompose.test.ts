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
 * self→proxy × chunked structs: non-proxy Caller.poke → deployProxy Acc.append (Item[] pooled
 * field fill + nested Probe, the product shape that emits delegateArtifact for Item[]+string)
 * under compose with executionArtifact/executor. Empty→first-write settles with ChunkNft mint.
 */
describe('kernel self→proxy chunked-struct compose', () => {
  it('settles Caller.poke→deployProxy Acc Item[] append under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 40; index += 1) {
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

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      struct Item { int amount; string label; bool active; }
      contract Acc() {
        Item[] items;
        function initialize() public { require(true); }
        function append(address probe, int amount, string label) public {
          this.items.push();
          int id = this.items.length - 1;
          this.items[id].amount = amount;
          this.items[id].label = label;
          this.items[id].active = true;
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function append(address probe, int amount, string label) external; }
      contract Caller() {
        function poke(address acc, address probe, int amount, string label) public {
          IAcc(acc).append(probe, amount, label);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(callsite?.callsiteId).toBeDefined();
    const probeCallsite = delegate.abi.find((entry) => entry.name === 'append')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(probeCallsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, probe.inner.lockingBytecode, 7n, 'first'],
      }, {
        contract: deployed.proxy,
        functionName: 'append',
        args: [probe.inner.lockingBytecode, 7n, 'first'],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
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
    expect((await deployed.proxy.getState()).items).toEqual([
      { amount: 7n, label: 'first', active: true },
    ]);
  }, 300_000);
});
