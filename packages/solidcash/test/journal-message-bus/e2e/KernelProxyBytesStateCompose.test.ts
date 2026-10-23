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

const asBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
  throw new Error(`unexpected bytes state: ${typeof value}`);
};

/**
 * deployProxy implementation owns a top-level dynamic `bytes` (chunk-backed) state cell. Write and
 * append mutate the grafted proxy-category payload under KERNEL dispatch and compose+executionArtifact.
 */
describe('kernel proxy-self bytes chunk state under composition', () => {
  it('settles deployProxy setPayload/append via dispatch send on proxy-owned bytes', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 24; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        bytes payload;
        function initialize() public { this.payload = hex""; }
        function setPayload(bytes value) public { this.payload = value; require(true); }
        function append(bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.delegateArtifact).toBeDefined();
    expect(artifact.delegateArtifact!.abi.find((entry) => entry.name === 'setPayload')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['payload']));
    expect(artifact.delegateArtifact!.abi.find((entry) => entry.name === 'append')?.dynamicWrites)
      .toEqual(expect.arrayContaining(['payload']));

    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    expect(binToHex(asBytes((await deployed.proxy.getState()).payload))).toBe('');

    const head = hexToBin('aabb');
    const setBuilder = await (deployed as any).setPayload(head).build() as TransactionBuilder;
    expect(vmAccepts(setBuilder)).toBe(true);
    expect(setBuilder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward')).toBe(true);

    await expect((deployed as any).setPayload(head).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(binToHex(asBytes((await deployed.proxy.getState()).payload))).toBe('aabb');

    const tail = hexToBin('cc');
    const appendBuilder = await (deployed as any).append(tail).build() as TransactionBuilder;
    expect(vmAccepts(appendBuilder)).toBe(true);
    await expect((deployed as any).append(tail).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(binToHex(asBytes((await deployed.proxy.getState()).payload))).toBe('aabbcc');
  }, 300_000);

  it('settles deployProxy append→Probe.touch via compose+executionArtifact on proxy-owned bytes', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x64), provider);
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
        bytes payload;
        function initialize(bytes initial) public { this.payload = initial; }
        function append(address probe, bytes suffix) public {
          this.payload = bytes.concat(this.payload, suffix);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    const delegate = artifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });

    const seed = hexToBin('11');
    const deployed = await upgrades.deployProxy(getContractFactory(artifact, signer), [seed]);
    expect(binToHex(asBytes((await deployed.proxy.getState()).payload))).toBe('11');
    deployed.implementation._registerResolvedExternal('IProbe', probe);

    const callsite = delegate.abi.find((entry) => entry.name === 'append')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'append',
        args: [probe.inner.lockingBytecode, hexToBin('22')],
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
    expect(binToHex(asBytes((await deployed.proxy.getState()).payload))).toBe('1122');
  }, 300_000);
});
