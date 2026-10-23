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
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const PUBLIC_CALLER_IDENTITY = {
  version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};

const fundSigner = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
  fill: number,
): Promise<Signer> => {
  const privateKey = new Uint8Array(32).fill(fill);
  const signer = new Signer(privateKey, provider);
  for (let index = 0; index < 40; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'),
      vout: 0,
      satoshis: 1_000_000n,
    });
  }
  return signer;
};

const deployCallee = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
): Promise<{
  callee: ReturnType<typeof StatefulContract.withCategory>;
  artifact: ReturnType<typeof compileString>;
}> => {
  const artifact = compileString(`pragma solidity ^0.8.0;
    contract CallerIdentityNestedCallee {
      function check(address expectedSender) public {
        require(msg.sender == expectedSender);
      }
    }`, { ...KERNEL, messageBusGraphContext: true });
  expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
  expect(artifact.abi.find((entry) => entry.name === 'check')?.usesMsgSender).toBe(true);

  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, {}, { saltContract: true },
  );
  const callee = StatefulContract.withCategory(
    base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
  );
  return { callee, artifact };
};

describe('kernel callsite caller identity under proxy / own-impl compose', () => {
  it('proxy: nested callee sees msg.sender equal to the authenticated public proxy identity', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = await fundSigner(provider, 0x4d);
    const { callee } = await deployCallee(provider);

    // Inferred delegateArtifact path (ordinary public impl under deployProxy).
    const implArtifact = compileString(`pragma solidity ^0.8.0;
      interface ICallerIdentityNestedCallee {
        function check(address expectedSender) external;
      }
      contract ProxyCallerIdentityAcc() {
        int counter;
        function initialize() public { this.counter = 0; }
        function fire(address nested, address expectedSender) public {
          ICallerIdentityNestedCallee(nested).check(expectedSender);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'fire'))
      .toMatchObject({ eligible: true });
    const checkCall = delegate.abi.find((entry) => entry.name === 'fire')
      ?.externalCalls?.find((call) => call.functionName === 'check');
    expect(checkCall?.callerIdentity).toEqual(PUBLIC_CALLER_IDENTITY);
    expect(checkCall?.callsiteId).toBeDefined();

    const deployed = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer),
      [],
    );
    deployed.implementation._registerResolvedExternal('ICallerIdentityNestedCallee', callee);

    const proxyLock = addressToLockScript(await deployed.getAddress());
    const executorLock = hexToBin(deployed.implementation.inner.lockingBytecode);
    expect(proxyLock).not.toEqual(hexToBin(deployed.proxy.inner.lockingBytecode));
    expect(proxyLock).not.toEqual(executorLock);

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'fire',
        args: [callee.inner.lockingBytecode, proxyLock],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: callee,
        functionName: 'check',
        args: [proxyLock],
        callsiteId: checkCall!.callsiteId!,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await (deployed as any).counter()).toBe(1n);
  }, 300_000);

  it('own-impl delegate: nested callee sees public identity, not the executor; foreign stays refused', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = await fundSigner(provider, 0x4e);
    const { callee } = await deployCallee(provider);

    // Explicit `delegate` modifier: the source artifact itself is the own-impl executor.
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ICallerIdentityNestedCallee {
        function check(address expectedSender) external;
      }
      contract OwnImplCallerIdentityAcc() {
        int counter;
        function initialize() public { this.counter = 0; }
        function fire(address nested, address expectedSender) delegate {
          ICallerIdentityNestedCallee(nested).check(expectedSender);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeUndefined();
    expect(implArtifact.abi.find((entry) => entry.name === 'fire')?.modifiers)
      .toEqual(expect.arrayContaining(['delegate']));
    expect(implArtifact.messageBus?.handlers.find((handler) => handler.name === 'fire'))
      .toMatchObject({ eligible: true });
    const checkCall = implArtifact.abi.find((entry) => entry.name === 'fire')
      ?.externalCalls?.find((call) => call.functionName === 'check');
    // The compiler publishes the active caller policy; the SCID anchor authenticates its public identity.
    expect(checkCall?.callerIdentity).toEqual(PUBLIC_CALLER_IDENTITY);
    expect(checkCall?.callsiteId).toBeDefined();

    const foreign = compileString(`pragma solidcash >=0.8.0;
      contract ForeignDelegateDenied(address impl) {
        function denied(bytes input) public {
          impl.delegatecall(input);
          require(true);
        }
      }`, KERNEL);
    expect(foreign.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });

    const deployed = await upgrades.deployProxy(
      getContractFactory(implArtifact, signer),
      [],
    );
    deployed.implementation._registerResolvedExternal('ICallerIdentityNestedCallee', callee);

    const ownerLock = addressToLockScript(await deployed.getAddress());
    const executorLock = hexToBin(deployed.implementation.inner.lockingBytecode);
    expect(ownerLock).not.toEqual(hexToBin(deployed.proxy.inner.lockingBytecode));
    expect(ownerLock).not.toEqual(executorLock);

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'fire',
        args: [callee.inner.lockingBytecode, ownerLock],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: callee,
        functionName: 'check',
        // Authenticated public proxy identity — never the foreign/own executor lock.
        args: [ownerLock],
        callsiteId: checkCall!.callsiteId!,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const executorInput = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address);
    expect(executorInput).toBeGreaterThanOrEqual(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(await (deployed as any).counter()).toBe(1n);
  }, 300_000);
});
