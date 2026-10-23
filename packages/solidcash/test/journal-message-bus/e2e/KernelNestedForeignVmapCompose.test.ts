import { hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
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

describe('kernel nested foreign vmap compose', () => {
  it('Caller→Bank writes nested allowance-class mapping under compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const bankArtifact = compileString(`pragma solidity ^0.8.0;
      contract Bank {
        mapping(uint256 => mapping(uint256 => uint256)) nest;
        function seed(uint256 owner, uint256 spender, uint256 v) public {
          nest[owner][spender] = v;
          require(true);
        }
        function approve(uint256 owner, uint256 spender, uint256 v) public {
          nest[owner][spender] = v;
          require(true);
        }
        function credit(uint256 owner, uint256 spender, uint256 v) public {
          nest[owner][spender] += v;
          require(true);
        }
      }`, KERNEL);
    expect(bankArtifact.messageBus?.handlers.find((h) => h.name === 'credit'))
      .toMatchObject({ eligible: true });
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(1n, 2n, 10n).send();

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IBank {
        function credit(uint256 owner, uint256 spender, uint256 v) external;
      }
      contract Caller(address bank) {
        function poke(uint256 owner, uint256 spender, uint256 v) public {
          IBank(bank).credit(owner, spender, v);
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
        { contract: caller, functionName: 'poke', args: [1n, 2n, 5n] },
        { contract: bank, functionName: 'credit', args: [1n, 2n, 5n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const bankRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Bank'
      && input.unlocker.abiFunction.name === bankArtifact.messageBus!.route.name);
    expect(bankRoute).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[bankRoute].unlocker;
    if (!('params' in unlocker)) throw new Error('bank route missing params');
    const predOutIdx = bankArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutIdx).toBeGreaterThanOrEqual(0);
    expect(Number(unlocker.params[predOutIdx] as bigint) === -1
      || Number(unlocker.params[predOutIdx] as bigint) >= 0).toBe(true);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    // Nested mapping entry address uses the outer collection name; read via getEntryNftAddress path.
    const ea = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'nest');
    const entries = SortedList.fromUtxos(await provider.getUtxos(ea)).all;
    expect(entries.length).toBeGreaterThan(0);
    // At least one mutable entry carries the post-credit value 15 (or nested encoding containing it).
    const values = entries.map((e) => {
      try {
        return vmNumberToBigInt(e.value, { requireMinimalEncoding: false });
      } catch {
        return undefined;
      }
    });
    expect(values.some((v) => v === 15n)).toBe(true);
  }, 180_000);
});
