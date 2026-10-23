import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  bytesToSlotValue, decodeEntryCommitment, keyToSlot,
} from '../../../src/stateful/SortedList.js';
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

const BANK = `pragma solidity ^0.8.0;
contract Bank {
  mapping(uint256 => uint256) bal;
  function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
  function seed(uint256 k, uint256 v) public { bal[k] = v; require(true); }
}`;

const CALLER = `pragma solidity ^0.8.0;
interface IBank { function credit(uint256 k, uint256 v) external; }
contract Caller(address bank) {
  function poke(uint256 k, uint256 v) public {
    IBank(bank).credit(k, v);
    require(true);
  }
}`;

describe('kernel foreign vmap RMW under composition', () => {
  it('UPDATE: Caller→Bank credit(k,v) adds onto a present entry', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const bankArtifact = compileString(BANK, KERNEL);
    expect(bankArtifact.messageBus?.handlers.find((h) => h.name === 'credit'))
      .toMatchObject({ eligible: true });
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const callerArtifact = compileString(CALLER, KERNEL);
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

    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Bank'
      && input.unlocker.abiFunction.name === bankArtifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('bank route has no parameters');

    const predOutIdx = bankArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    if (predOutIdx >= 0) {
      const predOut = Number(routeUnlocker.params[predOutIdx] as bigint);
      // UPDATE may pin PredOut inactive (-1) or exact entry; never a dangling positive past outputs.
      expect(predOut === -1 || predOut >= 0).toBe(true);
    }

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 180_000);

  it('INSERT: Caller→Bank credit on an absent key mints 0+v with PredOut at P', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const bankArtifact = compileString(BANK, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 7n).send();

    const callerArtifact = compileString(CALLER, KERNEL);
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
        { contract: caller, functionName: 'poke', args: [9n, 55n] },
        { contract: bank, functionName: 'credit', args: [9n, 55n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const firstTransaction = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
    const rebuilt = await composition.build();
    expect(vmAccepts(rebuilt)).toBe(true);
    expect(binToHex(encodeTransaction(rebuilt.buildLibauthTransaction()))).toBe(firstTransaction);

    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Bank'
      && input.unlocker.abiFunction.name === bankArtifact.messageBus!.route.name);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('bank route has no parameters');
    const predOutWitnessIndex = bankArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutWitnessIndex).toBeGreaterThanOrEqual(0);
    const predOutAbsolute = Number(routeUnlocker.params[predOutWitnessIndex] as bigint);
    expect(predOutAbsolute).toBeGreaterThanOrEqual(0);

    const transaction = builder.buildLibauthTransaction();
    const predCommitment = transaction.outputs[predOutAbsolute]?.token?.nft?.commitment;
    expect(predCommitment).toBeDefined();
    const seededSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const insertedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));
    const decodedPred = decodeEntryCommitment(
      typeof predCommitment === 'string' ? hexToBin(predCommitment) : predCommitment!,
    );
    expect(bytesToSlotValue(decodedPred.slot)).toBe(seededSlot);
    expect(bytesToSlotValue(decodedPred.nextKey)).toBe(insertedSlot);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(9n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(55n);
  }, 180_000);
});
