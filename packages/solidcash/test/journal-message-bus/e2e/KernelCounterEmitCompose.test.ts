import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
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
 * Non-proxy counter+emit under recipe compose (Caller→Acc and Acc-root×Probe).
 *
 * Proxy+executionArtifact counter+emit green settle is `KernelSelfToProxyEventCompose`
 * (complete-graph discovery of the exact scalar write). Event-only proxy funder remains
 * covered by `KernelProxyEventFunderCompose`.
 */
describe('kernel counter+emit under composition', () => {
  it('settles Caller.poke→Acc.ping counter+emit under recipe compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int public counter;
        event Ping(int value);
        function ping(int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    expect(accArtifact.messageBus?.handlers.find((handler) => handler.name === 'ping'))
      .toMatchObject({ eligible: true });

    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IAcc { function ping(int value) external; }
      contract Caller() {
        function poke(address a, int value) public {
          IAcc(a).ping(value);
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
    caller._registerResolvedExternal('IAcc', acc);
    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'ping')!;

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'poke', args: [acc.inner.lockingBytecode, 7n] },
        { contract: acc, functionName: 'ping', args: [7n], callsiteId: callsite.callsiteId },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const accCategory = String(acc.categoryId).toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment?.length ?? 0;
      return hex === accCategory && output.token?.nft?.capability === 'none' && len > 0
        && !binToHex(
          typeof commitment === 'string' ? hexToBin(commitment) : commitment ?? new Uint8Array(),
        ).toLowerCase().startsWith('5343494401');
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await acc.getState()).counter).toBe(1n);
  }, 300_000);

  it('settles Acc-root ping×Probe counter+emit under recipe compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
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

    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int public counter;
        event Ping(int value);
        function ping(address probe, int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    const callsite = accArtifact.abi.find((entry) => entry.name === 'ping')!
      .externalCalls!.find((call) => call.functionName === 'touch')!;

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: acc, functionName: 'ping', args: [probe.inner.lockingBytecode, 7n] },
        { contract: probe, functionName: 'touch', args: [], callsiteId: callsite.callsiteId },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await acc.getState()).counter).toBe(1n);
  }, 300_000);
});
