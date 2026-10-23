import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
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

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  evmCompat: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('delegated dual runtime mapping-set streams', () => {
  it('materializes compiler-owned keys inside the delegated balanced route', async () => {
    const artifact = compileString(SOURCE, OPTIONS);
    const delegate = artifact.delegateArtifact!;
    const update = delegate.abi.find((entry) => entry.name === 'update')!;
    expect(delegate.messageBus?.convention).toBe('kernel-row-loop');
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(update.sortedUpsertLoopInfo).toHaveLength(2);
    expect(update.sortedUpsertLoopInfo?.map((stream) => ({
      collection: stream.collection,
      valueConst: stream.valueConst,
      op: stream.op,
      group: stream.journalExecutionGroup,
    }))).toEqual([
      { collection: 'membership', valueConst: '1', op: 'set', group: 0 },
      { collection: 'membership', valueConst: '0', op: 'set', group: 1 },
    ]);
    expect(delegate.messageBus!.route.inputs
      .filter((input) => input.name.startsWith('__message_bus_key_')).map((input) => input.name))
      .toEqual([
        '__message_bus_key_membership_0', '__message_bus_key_membership_1',
        '__message_bus_key_membership_0_alt', '__message_bus_key_membership_1_alt',
      ]);
    // The route commits its whole result vector to one output-only slot and no longer reserves one conditional
    // return slot per possible row, so the frame is the state block plus the trailing key pool rather than a
    // maximumRows-padded return bank.
    expect(delegate.messageBus?.route.blockLayout).toMatchObject({
      blockSize: 134,
      trailingBase: 4,
      trailingCapacity: 130,
    });
    const delegateLayout = delegate.messageBus!.route.blockLayout!;
    expect(delegateLayout.trailingBase! + delegateLayout.trailingCapacity!).toBe(delegateLayout.blockSize);
    // The physical executor and logical identity follow the complete compiler-owned route frame.
    expect(delegate.messageBus!.route.blockLayout!.blockSize + 2).toBe(136);
    const routeAsm = bytecodeToAsm(hexToBin(delegate.functionBodies![delegate.messageBus!.route.selector]));
    expect(routeAsm).toContain('OP_INVOKE');

    const provider = createTestProvider();
    const privateKey = new Uint8Array(32);
    privateKey.fill(0x27);
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
    expect(deployed.proxy.inner.artifact.abi.find((entry) => entry.name === '__forward')?.inputs)
      .toHaveLength(2);
    const account = signer.getAddress();
    const probeArtifact = compileString(PROBE_SOURCE, { ...OPTIONS, messageBusGraphContext: true });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    const callsite = delegate.abi.find((entry) => entry.name === 'update')?.externalCalls?.[0];
    expect(callsite).toMatchObject({ callsiteId: 0, interfaceName: 'IProbe', functionName: 'touch' });
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const updateCall = messageBus.compose({
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
    // The stock BCH-2026 density gate is the next expected boundary for this maximal two-stream route. Reaching
    // it proves argument materialization and the exact balanced-width checks completed without an out-of-band
    // predecessor/funder. This test intentionally makes no semantic-acceptance claim at that capacity boundary.
    await expect(updateCall.build()).rejects.toThrow(/operation cost density limit/);
  }, 180_000);
});
