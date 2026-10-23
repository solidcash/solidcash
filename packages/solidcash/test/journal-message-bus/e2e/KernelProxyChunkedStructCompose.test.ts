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
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

/**
 * deployProxy Acc owns a chunk-backed dynamic struct array. Dispatch covers fixed-width `Detail[]`
 * push; compose+executionArtifact×Probe covers pooled `Item[]` push + element field fill (string
 * leaf) on the grafted proxy category — matching the self pooled-writer shape.
 */
describe('kernel proxy-self chunked-struct state under composition', () => {
  it('settles deployProxy Detail[] append via dispatch send on proxy-owned chunks', async () => {
    // Fixed-width Detail[] is delegate-eligible without an external co-spend; Item[]+string needs a
    // nested callsite (covered by the compose×Probe cell below) before delegateArtifact is emitted.
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const artifact = compileString(`pragma solidcash >=0.8.0;
      struct Detail { int code; int status; }
      contract Acc() {
        Detail[] details;
        function initialize() public { require(true); }
        function append(int code, int status) public {
          this.details.push(Detail(code, status));
          require(true);
        }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();
    expect(artifact.delegateArtifact!.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['details']));
    expect(artifact.delegateArtifact!.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    expect((await deployed.proxy.getState()).details).toEqual([]);

    const appendBuilder = await (deployed as any).append(70n, 1n).build() as TransactionBuilder;
    expect(vmAccepts(appendBuilder)).toBe(true);
    expect(appendBuilder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward')).toBe(true);

    await expect((deployed as any).append(70n, 1n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await deployed.proxy.getState()).details).toEqual([
      { code: 70n, status: 1n },
    ]);
  }, 300_000);

  it('settles deployProxy Item[] append→Probe.touch via compose+executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x69), provider);
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
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        struct Item { int amount; string label; bool active; }
        Item[] items;
        function initialize() public { require(true); }
        function append(address probe, int amount, string label) public {
          this.items.push();
          int id = this.items.length - 1;
          this.items[id].amount = amount;
          this.items[id].label = label;
          this.items[id].active = true;
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(delegate.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['items']));

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    expect((await deployed.proxy.getState()).items).toEqual([]);
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callsite = delegate.abi.find((entry) => entry.name === 'append')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'append',
        args: [probe.inner.lockingBytecode, 7n, 'first'],
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

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward')).toBe(true);

    // Chunk-backed Item[] outputs stay on the proxy category (not the implementation category).
    const proxyCategory = String(deployed.proxy.categoryId).toLowerCase();
    const chunkOutputs = builder.buildLibauthTransaction().outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      return hex === proxyCategory && output.token?.nft?.capability === 'mutable';
    });
    expect(chunkOutputs.length).toBeGreaterThan(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await deployed.proxy.getState()).items).toEqual([
      { amount: 7n, label: 'first', active: true },
    ]);
  }, 300_000);
});
