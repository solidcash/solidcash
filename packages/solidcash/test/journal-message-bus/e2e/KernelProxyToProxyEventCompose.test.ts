import { binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder } from '../../test-util.js';
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
 * proxy→foreign-proxy × events: deployProxy Acc.poke → deployProxy Bank.ping under compose with
 * dual executionArtifact/executor. Event NFT lands on the callee (Bank) proxy category.
 */
describe('kernel proxy → foreign-proxy event compose', () => {
  it('settles deployProxy poke→deployProxy Ping under compose with event on callee proxy category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x47), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        int counter;
        event Ping(int value);
        function initialize() public { this.counter = 0; }
        function ping(int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, KERNEL);
    expect(bankArtifact.delegateArtifact).toBeDefined();
    expect(bankArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'ping'))
      .toMatchObject({ eligible: true });

    const bank = await upgrades.deployProxy(getContractFactory(bankArtifact, signer), []);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function ping(int value) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address bank, int value) public {
          IBank(bank).ping(value);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
    const delegate = callerArtifact.delegateArtifact!;
    expect(delegate.messageBus?.handlers.find((h) => h.name === 'poke'))
      .toMatchObject({ eligible: true });

    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IBank', bank.proxy);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'ping');
    expect(callsite?.callsiteId).toBeDefined();

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [bank.proxy.inner.lockingBytecode, 7n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: bank.proxy,
        functionName: 'ping',
        args: [7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: bank.implementation.inner.artifact,
        executor: bank.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const forwardInputs = builder.inputs.filter((input) => 'contract' in input.unlocker
      && input.unlocker.abiFunction.name === '__forward');
    expect(forwardInputs.length).toBeGreaterThanOrEqual(2);

    const transaction = builder.buildLibauthTransaction();
    const bankCategory = String(bank.proxy.categoryId).toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment?.length ?? 0;
      return hex === bankCategory && output.token?.nft?.capability === 'none' && len > 0
        && !binToHex(
          typeof commitment === 'string' ? hexToBin(commitment) : commitment ?? new Uint8Array(),
        ).toLowerCase().startsWith('5343494401');
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await bank.proxy.getState()).counter).toBe(1n);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 300_000);

  it('carries an opt-in proxy-forward V5 envelope only through the root payload and passes both proxy VMs', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x48), provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const forwardKernel = { ...KERNEL, messageBusProxyForwardEnvelope: true } as const;
    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        int counter;
        event Ping(int value);
        function initialize() public { this.counter = 0; }
        function ping(int value) public {
          emit Ping(value);
          this.counter = this.counter + 1;
          require(true);
        }
      }`, forwardKernel);
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function ping(int value) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address bank, int value) public {
          IBank(bank).ping(value);
          this.count = this.count + 1;
          require(true);
        }
      }`, forwardKernel);
    for (const artifact of [callerArtifact, bankArtifact]) {
      expect(artifact.delegateArtifact?.messageBus?.verifierProgram?.envelopeTransport).toBe('proxy-forward');
      expect(artifact.delegateArtifact?.messageBus?.atomicMessageBus?.messageEnvelope.region)
        .toBe('proxy-forward');
    }
    const bank = await upgrades.deployProxy(getContractFactory(bankArtifact, signer), []);
    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IBank', bank.proxy);
    const callsite = callerArtifact.delegateArtifact!.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'ping');
    expect(callsite?.callsiteId).toBeDefined();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [bank.proxy.inner.lockingBytecode, 7n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: bank.proxy,
        functionName: 'ping',
        args: [7n],
        callsiteId: callsite!.callsiteId,
        executionArtifact: bank.implementation.inner.artifact,
        executor: bank.implementation,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    const rootInstructions = decodeAuthenticationInstructions(
      builder.inputs[0].unlocker.generateUnlockingBytecode({ inputIndex: 0 } as never),
    );
    const payloadInstruction = rootInstructions[1];
    expect(payloadInstruction && 'data' in payloadInstruction).toBe(true);
    if (!payloadInstruction || !('data' in payloadInstruction)) throw new Error('missing proxy-forward payload');
    const payload = payloadInstruction.data;
    expect(binToHex(payload.subarray(0, 4))).toBe('53434231'); // SCB1
    expect(payload[4]).toBe(0x4d); // exact PUSHDATA2 envelope frame
    const envelopeLength = payload[5] + (payload[6] << 8);
    expect(envelopeLength).toBe(payload.length - 7);
    expect(binToHex(payload.subarray(7, 11))).toBe('4c334331'); // L3C1

    const verifierInputs = builder.inputs.filter((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName.startsWith('MessageBusVerifier_'));
    expect(verifierInputs).toHaveLength(2);
    for (const input of verifierInputs) {
      const pushes = decodeAuthenticationInstructions(input.unlocker.generateUnlockingBytecode({} as never));
      expect(pushes.slice(0, -1).some((instruction) => 'data' in instruction
        && binToHex(instruction.data.subarray(0, 4)) === '4c334331')).toBe(false);
    }
    expect(vmAccepts(builder)).toBe(true);

    const rootExecutorIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === caller.implementation.inner.address);
    expect(rootExecutorIndex).toBeGreaterThan(0);
    const expectOneSidedEnvelopeMutationRejected = (
      inputIndex: number, pushIndex: number, domainOffset: number,
    ): void => {
      const originalInput = builder.inputs[inputIndex];
      const originalUnlocker = originalInput.unlocker;
      builder.inputs[inputIndex] = {
        ...originalInput,
        unlocker: {
          ...originalUnlocker,
          generateUnlockingBytecode(options) {
            const original = originalUnlocker.generateUnlockingBytecode(options);
            const instructions = decodeAuthenticationInstructions(original);
            const target = instructions[pushIndex];
            if (!target || !('data' in target)
              || binToHex(target.data.subarray(domainOffset, domainOffset + 4)) !== '4c334331') {
              throw new Error('missing one-sided L3C1 mutation target');
            }
            const changed = target.data.slice();
            changed[changed.length - 1] ^= 1;
            instructions[pushIndex] = { ...target, data: changed };
            const rewritten = encodeAuthenticationInstructions(instructions);
            if (rewritten.length !== original.length
              || rewritten.reduce((count, byte, index) => count + Number(byte !== original[index]), 0) !== 1) {
              throw new Error('one-sided L3C1 mutation changed more than one unlocking byte');
            }
            return rewritten;
          },
        },
      };
      try {
        expect(vmAccepts(builder)).toBe(false);
      } finally {
        builder.inputs[inputIndex] = originalInput;
      }
    };
    // The unchanged executor rejects a changed proxy payload, and the unchanged proxy rejects a changed
    // executor envelope. Neither hostile transaction is sent; the original unlockers are restored afterward.
    expectOneSidedEnvelopeMutationRejected(0, 1, 7);
    expectOneSidedEnvelopeMutationRejected(rootExecutorIndex, 1, 0);
    expect(vmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await caller.proxy.getState()).count).toBe(1n);
    expect((await bank.proxy.getState()).counter).toBe(1n);
  }, 300_000);
});
