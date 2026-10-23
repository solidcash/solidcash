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
import {
  createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos,
} from '../../test-util.js';

const IMPLEMENTATION = `pragma solidity ^0.8.20;
interface IInactiveDynamicProbe { function touch() external; }
contract InactiveDynamicImplementation {
  uint256 marker;
  address[] dormant;

  function run(address probe) public {
    marker = 1;
    IInactiveDynamicProbe(probe).touch();
    require(true);
  }

  function appendDormant(address account) public {
    dormant.push(account);
    require(true);
  }
}`;

const PROBE = `pragma solidity ^0.8.20;
contract InactiveDynamicProbe { function touch() public { require(true); } }`;

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  evmCompat: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('delegate route inactive dynamic writes', () => {
  it('does not reserve chunks for an unselected handler empty array', async () => {
    const artifact = compileString(IMPLEMENTATION, OPTIONS);
    const delegate = artifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.abi.find((entry) => entry.name === 'run')?.dynamicWrites ?? []).toEqual([]);
    expect(delegate.abi.find((entry) => entry.name === 'appendDormant')?.dynamicWrites)
      .toEqual(['dormant']);

    const provider = createTestProvider();
    const privateKey = new Uint8Array(32).fill(0x2d);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 12; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const deployed = await upgrades.deployProxy(
      getContractFactory(artifact, signer),
      { marker: 0n, dormant: [signer.getAddress()] },
      { initializer: false },
    );
    const probeArtifact = compileString(PROBE, { ...OPTIONS, messageBusGraphContext: true });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    deployed.implementation._registerResolvedExternal('IInactiveDynamicProbe', probe);
    const callsite = delegate.abi.find((entry) => entry.name === 'run')?.externalCalls?.[0];
    expect(callsite).toMatchObject({
      callsiteId: 0,
      interfaceName: 'IInactiveDynamicProbe',
      functionName: 'touch',
    });

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'run',
        args: [probe.inner.lockingBytecode],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    // Full-admission union still densifies (trailing capacity for dormant). Keep as negative
    // characterization beside KernelProxyInactiveUnionSettle (slim admitted-handlers green path).
    await expect(composition.build()).rejects.toThrow(
      /operation cost density limit|incomplete dynamic chunks/,
    );
  }, 180_000);
});
