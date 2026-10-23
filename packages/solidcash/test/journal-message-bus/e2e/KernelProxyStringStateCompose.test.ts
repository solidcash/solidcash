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

const asUtf8 = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  throw new Error(`unexpected string state: ${typeof value}`);
};

/**
 * deployProxy implementation owns a top-level `string` state cell. Write and append mutate the grafted
 * proxy-category string under KERNEL (dispatch `.send()` and compose+executionArtifact×Probe).
 */
describe('kernel proxy-self string state under composition', () => {
  it('settles deployProxy setNote/append via dispatch send on proxy-owned string', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x61), provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        string note;
        function initialize() public { this.note = ""; }
        function setNote(string value) public { this.note = value; require(true); }
        function append(string suffix) public {
          this.note = string.concat(this.note, suffix);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();
    expect(artifact.delegateArtifact!.abi.find((entry) => entry.name === 'setNote')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['note']));
    expect(artifact.delegateArtifact!.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['note']));

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    expect(asUtf8((await deployed.proxy.getState()).note)).toBe('');

    const setBuilder = await (deployed as any).setNote('alpha').build() as TransactionBuilder;
    expect(vmAccepts(setBuilder)).toBe(true);
    expect(setBuilder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);
    expect(setBuilder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward')).toBe(true);

    await expect((deployed as any).setNote('alpha').send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(asUtf8((await deployed.proxy.getState()).note)).toBe('alpha');

    const appendBuilder = await (deployed as any).append('-beta').build() as TransactionBuilder;
    expect(vmAccepts(appendBuilder)).toBe(true);
    await expect((deployed as any).append('-beta').send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(asUtf8((await deployed.proxy.getState()).note)).toBe('alpha-beta');
  }, 300_000);

  it('settles deployProxy append→Probe.touch via compose+executionArtifact on proxy-owned string', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x62), provider);
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
        string note;
        function initialize(string initial) public { this.note = initial; }
        function append(address probe, string suffix) public {
          this.note = string.concat(this.note, suffix);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(delegate.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['note']));

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), ['seed']);
    expect(asUtf8((await deployed.proxy.getState()).note)).toBe('seed');
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callsite = delegate.abi.find((entry) => entry.name === 'append')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'append',
        args: [probe.inner.lockingBytecode, '-tail'],
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

    // Chunk-backed string outputs stay on the proxy category (not the implementation category).
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
    expect(asUtf8((await deployed.proxy.getState()).note)).toBe('seed-tail');
  }, 300_000);
});
