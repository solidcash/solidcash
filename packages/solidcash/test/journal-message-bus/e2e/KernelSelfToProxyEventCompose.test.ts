import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
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
 * self→proxy × events: non-proxy Caller.poke → deployProxy Acc.ping under compose with
 * executionArtifact/executor on the proxy callee. Event NFT lands on the proxy category.
 */
describe('kernel self→proxy event under composition', () => {
  it('settles Caller.poke→deployProxy Ping under compose with event on proxy category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int counter;
        event Ping(int value);
        function initialize() public { this.counter = 0; }
        function ping(int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'ping'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function ping(int value) external; }
      contract Caller() {
        function poke(address acc, int value) public {
          IAcc(acc).ping(value);
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
    caller._registerResolvedExternal('IAcc', deployed.proxy);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'ping');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [deployed.proxy.inner.lockingBytecode, 7n],
      }, {
        contract: deployed.proxy,
        functionName: 'ping',
        args: [7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const proxyCategory = String(deployed.proxy.categoryId).toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment?.length ?? 0;
      return hex === proxyCategory && output.token?.nft?.capability === 'none' && len > 0
        && !binToHex(
          typeof commitment === 'string' ? hexToBin(commitment) : commitment ?? new Uint8Array(),
        ).toLowerCase().startsWith('5343494401');
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await deployed.proxy.getState()).counter).toBe(1n);
  }, 300_000);
});
