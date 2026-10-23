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
 * self→proxy × strings: non-proxy Caller.poke → deployProxy Acc.setNote/append under compose with
 * executionArtifact/executor on the proxy callee. Empty→set and empty→append settle with ChunkNft mint
 * into the proxy trailing band.
 */
describe('kernel self→proxy string compose', () => {
  it('settles Caller.poke→deployProxy Acc setNote then append under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x74), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        string note;
        function initialize() public { this.note = ""; }
        function setNote(string value) public { this.note = value; require(true); }
        function append(string suffix) public {
          this.note = string.concat(this.note, suffix);
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'setNote'))
      .toMatchObject({ eligible: true });
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(delegate.abi.find((entry) => entry.name === 'setNote')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['note']));
    expect(delegate.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['note']));

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc {
        function setNote(string value) external;
        function append(string suffix) external;
      }
      contract Caller() {
        function pokeSet(address acc, string value) public {
          IAcc(acc).setNote(value);
          require(true);
        }
        function pokeAppend(address acc, string suffix) public {
          IAcc(acc).append(suffix);
          require(true);
        }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'pokeSet'))
      .toMatchObject({ eligible: true });
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'pokeAppend'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const setCallsite = callerArtifact.abi.find((entry) => entry.name === 'pokeSet')
      ?.externalCalls?.find((call) => call.functionName === 'setNote');
    expect(setCallsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const setComposition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'pokeSet',
        args: [deployed.proxy.inner.lockingBytecode, 'alpha'],
      }, {
        contract: deployed.proxy,
        functionName: 'setNote',
        args: ['alpha'],
        callsiteId: setCallsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(setComposition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await deployed.proxy.getState()).note).toBe('alpha');

    const appendCallsite = callerArtifact.abi.find((entry) => entry.name === 'pokeAppend')
      ?.externalCalls?.find((call) => call.functionName === 'append');
    expect(appendCallsite?.callsiteId).toBeDefined();
    const appendFunder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const appendComposition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'pokeAppend',
        args: [deployed.proxy.inner.lockingBytecode, '-beta'],
      }, {
        contract: deployed.proxy,
        functionName: 'append',
        args: ['-beta'],
        callsiteId: appendCallsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder: appendFunder,
      changeAddress: appendFunder.unlocker.generateLockingBytecode(),
    });
    await expect(appendComposition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await deployed.proxy.getState()).note).toBe('alpha-beta');
  }, 300_000);
});
