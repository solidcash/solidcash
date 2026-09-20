import { hexToBin } from '@bitauth/libauth';
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
 * Proxy event funder under `messageBus.compose` + `executionArtifact`.
 *
 * Direct deployProxy `withExternalCall` settles emit-funder. Attempted settle under compose
 * with scalar Probe.touch (same pattern as KernelProxyKeccakSidecarCompose): Acc emits Ping
 * then touches Probe. Build fails closed at BCH-2026 preflight OP_VERIFY — same refusal class
 * as KernelProxyForeignRmwEventCompose's deployProxy×foreign×event fence. Non-proxy event
 * funder under compose remains covered by KernelFunderGapTwoParticipant.
 */
describe('kernel proxy event funder under composition', () => {
  it('characterizes deployProxy Ping via compose+executionArtifact: OP_VERIFY at preflight', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4a), provider);
    for (let index = 0; index < 24; index += 1) {
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

    // Scalar-only Acc: emit Ping + foreign touch (no mapping RMW).
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        event Ping(int value);
        function initialize() public { this.counter = 0; }
        function ping(address probe, int value) public {
          this.counter = this.counter + 1;
          emit Ping(value);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.convention).toBe('kernel-row-loop');
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'ping'))
      .toMatchObject({ eligible: true });
    expect(delegate.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'event' || slot.kind === 'returnEvent',
    )).toBe(true);

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    const callsite = delegate.abi.find((entry) => entry.name === 'ping')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'ping',
        args: [probe.inner.lockingBytecode, 7n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.build()).rejects.toThrow(
      /messageBus: BCH-2026 preflight failed at input 13.*Program failed an OP_VERIFY operation/,
    );
  }, 300_000);
});
