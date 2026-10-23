import { bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
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
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

/**
 * Proxy executor × foreign mapping RMW × event.
 * Dispatch `withExternalCall`, fan-out compose, and deployProxy `messageBus.compose`+`executionArtifact`
 * all settle the three axes (after structural pads stopped stealing tx.origin from the fee tail).
 */
describe('kernel proxy × foreign RMW × event compose', () => {
  it('settles deployProxy poke→Bank.credit with Ping via withExternalCall', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x44);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function seed(int k, int v) public { bal[k] = v; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Coordinator() {
        int count;
        event Ping(int value);
        function initialize() public { this.count = 0; }
        function poke(address bank, int k, int v) public {
          emit Ping(v);
          IBank(bank).credit(k, v);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);

    await expect(
      (deployed as any).poke(bank.inner.lockingBytecode, 2n, 5n)
        .withExternalCall(bank, 'credit', [2n, 5n])
        .send(),
    ).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const entryAddress = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
    expect((await deployed.proxy.getState()).count).toBe(1n);
  }, 300_000);

  it('settles deployProxy poke→Bank.credit with Ping under messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x41);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function seed(int k, int v) public { bal[k] = v; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Coordinator() {
        int count;
        event Ping(int value);
        function initialize() public { this.count = 0; }
        function poke(address bank, int k, int v) public {
          emit Ping(v);
          IBank(bank).credit(k, v);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    expect(delegate).toBeDefined();
    expect(delegate.messageBus?.convention).toBe('kernel-row-loop');
    expect(delegate.messageBus?.handlers.find((handler) => handler.name === 'poke'))
      .toMatchObject({ eligible: true });

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    expect(callsite).toMatchObject({
      functionName: 'credit',
      interfaceName: 'IBank',
    });

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [bank.inner.lockingBytecode, 2n, 5n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: bank,
        functionName: 'credit',
        args: [2n, 5n],
        callsiteId: callsite!.callsiteId,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    const transaction = builder.buildLibauthTransaction();
    const proxyCategory = String(deployed.proxy.categoryId).toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment?.length ?? 0;
      return hex === proxyCategory && output.token?.nft?.capability === 'none' && len > 0;
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entryAddress = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
    expect((await deployed.proxy.getState()).count).toBe(1n);
  }, 300_000);

  it('settles foreign RMW × event via fan-out: Caller emits Ping and credits Bank in one compose', async () => {
    // Slim twin isolating foreign RMW × event (proxy executor still characterized above).
    const provider = createMessageBusCapstoneTestProvider();
    const bankArtifact = compileString(`pragma solidity ^0.8.0;
      contract Bank {
        mapping(uint256 => uint256) bal;
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
        function seed(uint256 k, uint256 v) public { bal[k] = v; require(true); }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IBank { function credit(uint256 k, uint256 v) external; }
      contract Caller(address bank) {
        event Ping(uint256 value);
        function poke(uint256 k, uint256 v) public {
          emit Ping(v);
          IBank(bank).credit(k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [bank.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'credit')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'poke', args: [2n, 5n] },
        { contract: bank, functionName: 'credit', args: [2n, 5n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const callerRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Caller'
      && input.unlocker.abiFunction.name === callerArtifact.messageBus!.route.name);
    expect(callerRoute).toBeGreaterThanOrEqual(0);

    const bankRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Bank'
      && input.unlocker.abiFunction.name === bankArtifact.messageBus!.route.name);
    expect(bankRoute).toBeGreaterThanOrEqual(0);
    const bankUnlocker = builder.inputs[bankRoute].unlocker;
    if (!('params' in bankUnlocker)) throw new Error('bank route missing params');
    const predOutIdx = bankArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutIdx).toBeGreaterThanOrEqual(0);
    const predOut = Number(bankUnlocker.params[predOutIdx] as bigint);
    // UPDATE of seeded key: PredOut inactive or a valid absolute index.
    expect(predOut === -1 || predOut >= 0).toBe(true);
    if (predOut >= 0) {
      expect(predOut).toBeLessThan(builder.buildLibauthTransaction().outputs.length);
    }

    const transaction = builder.buildLibauthTransaction();
    const callerCategory = callerSetup.categoryId.toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const commitmentLen = typeof commitment === 'string'
        ? commitment.length / 2
        : (commitment?.length ?? 0);
      return hex === callerCategory
        && output.token?.nft?.capability === 'none'
        && commitmentLen > 0
        && (output.valueSatoshis ?? 0n) > 0n;
    });
    expect(eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 180_000);
});
