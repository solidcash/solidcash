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
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

/**
 * M3a: approach mock BCH-2026 operation-cost density under messageBus.compose.
 * Uses the DualRuntimeSet maximal two-stream proxy×foreign route that hits
 * `operation cost density limit` after balanced-width checks — not encodeMessageBatch row caps.
 */
describe('kernel density-bounded compose', () => {
  it('fails closed with operation cost density limit on DualRuntimeSet-width compose', async () => {
    const SOURCE = `pragma solidity ^0.8.20;
interface IProbe { function touch() external; }
contract DelegatedSet {
  mapping(uint256 => mapping(address => bool)) public membership;

  function update(
    address probe,
    uint256 scope,
    address[] memory additions,
    address[] memory removals
  ) public {
    for (uint256 cursor = 0; cursor < additions.length; cursor++) {
      membership[scope][additions[cursor]] = true;
    }
    for (uint256 cursor = 0; cursor < removals.length; cursor++) {
      membership[scope][removals[cursor]] = false;
    }
    IProbe(probe).touch();
    require(true);
  }
}`;
    const PROBE_SOURCE = `pragma solidity ^0.8.20;
contract Probe { function touch() public { require(true); } }`;

    const artifact = compileString(SOURCE, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.convention).toBe('kernel-row-loop');
    expect(delegate.abi.find((entry) => entry.name === 'update')?.sortedUpsertLoopInfo)
      .toHaveLength(2);

    const provider = createTestProvider();
    const privateKey = new Uint8Array(32).fill(0x27);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 160; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: index.toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const deployed = await upgrades.deployProxy(
      getContractFactory(artifact, signer), {}, { initializer: false },
    );
    const probeArtifact = compileString(PROBE_SOURCE, { ...KERNEL, messageBusGraphContext: true });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    const callsite = delegate.abi.find((entry) => entry.name === 'update')?.externalCalls?.[0];
    expect(callsite).toMatchObject({ functionName: 'touch' });

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const account = signer.getAddress();
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'update',
        args: [probe.inner.lockingBytecode, 9n, [account], []],
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

    const started = Date.now();
    await expect(composition.build()).rejects.toThrow(/operation cost density limit/);
    expect(Date.now() - started).toBeLessThan(180_000);
  }, 240_000);

  it('settles a small same-key credit batch under the density gate', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        mapping(uint256 => uint256) bal;
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await contract.call.credit(1n, 0n).send();
    const call = contract.batch([
      { function: 'credit', args: [1n, 2n] },
      { function: 'credit', args: [1n, 3n] },
    ]);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(funder.utxo, funder.unlocker);
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 120_000);
});
