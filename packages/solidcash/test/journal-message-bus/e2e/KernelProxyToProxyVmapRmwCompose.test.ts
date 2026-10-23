import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  getContractFactory,
  upgrades,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
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
 * deployProxy Acc/Caller pokes another deployProxy Bank.credit under messageBus.compose with
 * executionArtifact/executor for BOTH proxies (dual __forward). Mirrors KernelProxyForeignVmapRmwCompose
 * with Bank also behind deployProxy.
 */
describe('kernel proxy → foreign-proxy vmap RMW compose', () => {
  it('settles deployProxy poke→deployProxy Bank.credit under compose with dual executionArtifact', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x46);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 60; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    // Mapping INSERT alone is not delegate-eligible; seed via same-key credit (0→10 INSERT then RMW).
    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    expect(bankArtifact.delegateArtifact).toBeDefined();
    expect(bankArtifact.delegateArtifact!.messageBus?.handlers.find((h) => h.name === 'credit'))
      .toMatchObject({ eligible: true });

    const bank = await upgrades.deployProxy(
      getContractFactory(bankArtifact, signer), {}, { initializer: false },
    );
    await (bank as any).credit(2n, 10n).send();

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Acc() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address bank, int k, int v) public {
          IBank(bank).credit(k, v);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = callerArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.handlers.find((h) => h.name === 'poke'))
      .toMatchObject({ eligible: true });

    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
    caller.implementation._registerResolvedExternal('IBank', bank.proxy);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    expect(callsite).toMatchObject({
      functionName: 'credit',
      interfaceName: 'IBank',
    });

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller.proxy,
        functionName: 'poke',
        args: [bank.proxy.inner.lockingBytecode, 2n, 5n],
        executionArtifact: caller.implementation.inner.artifact,
        executor: caller.implementation,
      }, {
        contract: bank.proxy,
        functionName: 'credit',
        args: [2n, 5n],
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

    const callerExecutor = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === caller.implementation.inner.address);
    expect(callerExecutor).toBeGreaterThanOrEqual(0);
    const bankExecutor = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === bank.implementation.inner.address);
    expect(bankExecutor).toBeGreaterThanOrEqual(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(bank.proxy.inner, bank.proxy.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
    expect((await caller.proxy.getState()).count).toBe(1n);
  }, 300_000);
});
