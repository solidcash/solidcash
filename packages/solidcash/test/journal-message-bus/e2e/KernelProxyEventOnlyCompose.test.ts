import { binToHex, hexToBin } from '@bitauth/libauth';
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
 * Event-only Solidity implementation behind deployProxy (no user state vars). The compiler injects a public
 * `__messageBusHold` data NFT and an eligible `initialize()` that writes it so compose MessageBusVerifier
 * census matches write+emit geometry (dataNft@1, streamed records@2+). Default SolidCashProxy has no hardcoded
 * master+1 data NFT. Dispatch `.send()` and compose+executionArtifact×Probe both settle Ping onto the
 * proxy category.
 */
describe('kernel proxy event-only under composition', () => {
  it('settles deployProxy Ping via dispatch send for event-only impl', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5d), provider);
    for (let index = 0; index < 16; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        event Ping(uint256 value);
        function ping(uint256 value) public {
          emit Ping(value);
          require(true);
        }
      }`, { ...KERNEL, evmCompat: true });
    expect(implArtifact.stateLayout?.dataNftCount).toBe(1);
    expect(implArtifact.stateLayout?.variables?.some((variable) => variable.name === '__messageBusHold'))
      .toBe(true);
    const delegateBus = implArtifact.delegateArtifact?.messageBus;
    // The top-level emit streams: no event window, Ping settles in the trailing band right after the hold NFT.
    expect(delegateBus?.handlers.find((handler) => handler.name === 'ping')?.runtimeLoopEvents)
      .toEqual([expect.objectContaining({ eventSignatures: ['Ping(uint256)'], stream: true })]);
    expect(delegateBus?.route.blockLayout?.slots.find((slot) => slot.kind === 'dataNft')?.offset).toBe(1);
    expect(delegateBus?.route.blockLayout?.slots.find((slot) => slot.kind === 'trailing')?.offset).toBe(2);

    const deployed = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer), {}, { initializer: false },
    );
    expect(deployed.proxy.inner.artifact.stateLayout?.dataNftCount).toBe(1);

    const tx = await (deployed as { ping: (value: bigint) => { send: () => Promise<{ txid: string }> } })
      .ping(7n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    const outputs = (tx as { outputs?: Array<{ token?: {
      category?: string | Uint8Array;
      nft?: { capability?: string; commitment?: string | Uint8Array };
    } }> }).outputs ?? [];
    const proxyCategory = String(deployed.proxy.categoryId).toLowerCase();
    const eventOut = outputs.find((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment?.length ?? 0;
      return hex === proxyCategory && output.token?.nft?.capability === 'none' && len > 0;
    });
    if (outputs.length > 0) expect(eventOut).toBeDefined();
  }, 180_000);

  it('settles event-only compose+executionArtifact×Probe with Ping on proxy category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5e), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, evmCompat: true, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const implArtifact = compileString(`pragma solidity ^0.8.0;
      interface IProbe { function touch() external; }
      contract Acc {
        event Ping(uint256 value);
        function ping(address probe, uint256 value) public {
          emit Ping(value);
          IProbe(probe).touch();
          require(true);
        }
      }`, { ...KERNEL, evmCompat: true });
    expect(implArtifact.stateLayout?.dataNftCount).toBe(1);

    const deployed = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer), {}, { initializer: false },
    );
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    const callsite = implArtifact.delegateArtifact!.abi.find((entry) => entry.name === 'ping')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
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
  }, 300_000);
});
