import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  messageBus, getContractFactory, upgrades, Signer,
} from '../../../src/index.js';
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
});
