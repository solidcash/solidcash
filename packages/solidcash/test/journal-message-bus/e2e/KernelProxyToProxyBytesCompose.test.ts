import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { createBareP2pkhFeeFunder } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const asBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
  throw new Error(`unexpected bytes state: ${typeof value}`);
};

/**
 * proxy→foreign-proxy × chunks: deployProxy Acc.poke → deployProxy Store.append under compose with
 * dual executionArtifact/executor. Empty→first-write settles with ChunkNft mint into each proxy
 * callee trailing band.
 */
describe('kernel proxy → foreign-proxy bytes under composition', () => {
  it('settles deployProxy poke→deployProxy Store empty→append under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x48), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        bytes payload;
        function initialize() public { this.payload = hex""; }
        function append(bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.delegateArtifact).toBeDefined();
    expect(storeArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.delegateArtifact!.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['payload']));

    const store = await upgrades.deployProxy(getContractFactory(storeArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function append(bytes suffix) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address store, bytes suffix) public {
          IStore(store).append(suffix);
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
    const suffix = hexToBin('22');
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [store.proxy.inner.lockingBytecode, suffix],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: store.proxy,
        functionName: 'append',
        args: [suffix],
        callsiteId: callsite!.callsiteId,
        executionArtifact: store.implementation.inner.artifact,
        executor: store.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(binToHex(asBytes((await store.proxy.getState()).payload))).toBe('22');
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
