import { hexToBin } from '@bitauth/libauth';
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
 * proxy→foreign-proxy × chunks: deployProxy Acc.poke → deployProxy Store.append under compose with
 * dual executionArtifact/executor. Empty→first-write fails closed (chunk covenant OP_EQUALVERIFY on
 * a short structural input) — honest fence after attempt. Contrast KernelProxyForeignBytesCompose
 * (proxy→foreign non-proxy Store) which settles the same empty→append shape.
 */
describe('kernel proxy → foreign-proxy bytes under composition', () => {
  it('refuses deployProxy poke→deployProxy Store empty→append under compose (honest fence)', async () => {
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

    // Measured: dual-proxy chunk mint path OP_EQUALVERIFY (short structural input ~ip 1/12).
    await expect(composition.send()).rejects.toThrow(/OP_VERIFY|preflight failed/);
  }, 300_000);
});
