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

const asUtf8 = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  throw new Error(`unexpected string state: ${typeof value}`);
};

/**
 * proxy→foreign × strings: deployProxy Acc.poke → foreign Store.append under compose+executionArtifact.
 * Empty→first-write settles (positive string chunk mint). Non-empty seeded RMW shares the foreign-chunk
 * compose fence characterized in KernelForeignStringRmwCompose.
 */
describe('kernel proxy × foreign string under composition', () => {
  it('settles deployProxy poke→Store empty→append under compose with executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        string note;
        function seed(string value) public { this.note = value; require(true); }
        function append(string suffix) public {
          this.note = string.concat(this.note, suffix);
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, { note: '' }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(string suffix) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address store, string suffix) public {
          IStore(store).append(suffix);
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
    const suffix = 'hi';
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, suffix],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: store,
        functionName: 'append',
        args: [suffix],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(asUtf8((await store.getState()).note)).toBe('hi');
    expect((await deployed.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
