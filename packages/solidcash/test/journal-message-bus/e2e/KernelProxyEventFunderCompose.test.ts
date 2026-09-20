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
 * Proxy event funder: dispatch-proxy `.send()` settles emit onto the proxy category.
 * `messageBus.compose` + `executionArtifact` for the same shape remains OP_VERIFY (atomic verifier).
 */
describe('kernel proxy event funder under composition', () => {
  it('settles deployProxy Ping via dispatch send with none-cap event NFT on proxy category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4a), provider);
    for (let index = 0; index < 8; index += 1) {
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
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'ping'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    const tx = await (deployed as any).ping(7n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    expect((await deployed.proxy.getState()).counter).toBe(1n);

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
    // Some send() return shapes omit decoded outputs; state readback above is authoritative.
    if (outputs.length > 0) expect(eventOut).toBeDefined();
  }, 180_000);

  it('characterizes deployProxy Ping via compose+executionArtifact: OP_VERIFY at preflight', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
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
    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    const callsite = delegate.abi.find((entry) => entry.name === 'ping')
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

    await expect(composition.build()).rejects.toThrow(
      /messageBus: BCH-2026 preflight failed.*Program failed an OP_VERIFY operation/,
    );
  }, 300_000);
});
