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
 * Upgrade-through-proxy then compose: `upgrades.deployProxy` with V1, retarget execution to a V2
 * implementation artifact, then one mutating row under `messageBus.compose` + `executionArtifact`.
 *
 * SolidCashProxy bakes the implementation locking bytecode as a constructor argument;
 * `upgrades.upgradeProxy` is not published. A real retarget of the compose executor to a distinct V2
 * locking bytecode fails closed when the compiler-authenticated forwarding target is not co-spent.
 */
describe('kernel proxy upgrade then composition', () => {
  it('characterizes deployProxy V1→V2 executor retarget under compose+executionArtifact: forwarding target not materialized', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x51), provider);
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
    const v1Artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract AccV1() {
        int counter;
        function initialize() public { this.counter = 0; }
        function bump(address probe) public {
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const v2Artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract AccV2() {
        int counter;
        function initialize() public { this.counter = 0; }
        function bump(address probe) public {
          this.counter = this.counter + 2;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const v1Delegate = v1Artifact.delegateArtifact!;
    const v2Delegate = v2Artifact.delegateArtifact!;
    expect(v1Delegate).toBeDefined();
    expect(v2Delegate).toBeDefined();
    expect(v1Delegate.messageBus?.handlers.find((handler) => handler.name === 'bump'))
      .toMatchObject({ eligible: true });
    expect(v2Delegate.messageBus?.handlers.find((handler) => handler.name === 'bump'))
      .toMatchObject({ eligible: true });

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const deployed = await upgrades.deployProxy(getContractFactory(v1Artifact, signer), []);
    expect(deployed.implementation.inner.artifact.contractName).toBe('AccV1');

    const v2Implementation = await getContractFactory(v2Artifact, signer).deploy({ logicalNonce: false });
    expect(v2Implementation.inner.artifact.contractName).toBe('AccV2');
    expect(v2Implementation.inner.lockingBytecode)
      .not.toBe(deployed.implementation.inner.lockingBytecode);

    (v2Implementation as unknown as StatefulContract)._registerResolvedExternal('IProbe', probe);
    const callsite = v2Delegate.abi.find((entry) => entry.name === 'bump')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'bump',
        args: [probe.inner.lockingBytecode],
        executionArtifact: v2Delegate,
        executor: v2Implementation as unknown as StatefulContract,
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
      "messageBus: participant 0 'AccV2' failed to build its balanced block: "
      + 'Compiler-authenticated delegate forwarding target is not materialized',
    );
  }, 300_000);
});
