import {
  bigIntToVmNumber, hexToBin, vmNumberToBigInt,
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

describe('kernel fan-in shared callee under composition', () => {
  it('two callers sequentially poke the same Registry; shared entries stay consistent', async () => {
    // One aggregate with two independent callers collapses (prepared 4 → graph 2). Fan-in settles as
    // staged composes against one shared Registry category (catalog: staged sends + compose).
    const provider = createMessageBusCapstoneTestProvider();

    const registryArtifact = compileString(`pragma solidity ^0.8.0;
      contract Registry {
        mapping(uint256 => uint256) bal;
        function set(uint256 k, uint256 v) public { bal[k] = v; require(true); }
      }`, KERNEL);
    const registryBase = new Contract(registryArtifact, [], { provider });
    const registrySetup = await setupStatefulUtxos(
      provider, registryBase, registryArtifact.stateLayout!, {}, { saltContract: true },
    );
    const registry = StatefulContract.withCategory(
      registryBase.withCategory(hexToBin(registrySetup.categoryId)), registrySetup.categoryId,
    );

    const callerSource = `pragma solidity ^0.8.0;
      interface IRegistry { function set(uint256 k, uint256 v) external; }
      contract Caller(address registry) {
        function poke(uint256 k, uint256 v) public {
          IRegistry(registry).set(k, v);
          require(true);
        }
      }`;
    const callerAArtifact = compileString(callerSource, KERNEL);
    const callerBArtifact = compileString(callerSource, KERNEL);

    const callerABase = new Contract(callerAArtifact, [registry.inner.lockingBytecode], { provider });
    const callerASetup = await setupStatefulUtxos(
      provider, callerABase, callerAArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callerA = StatefulContract.withCategory(
      callerABase.withCategory(hexToBin(callerASetup.categoryId)), callerASetup.categoryId,
    );

    const callerBBase = new Contract(callerBArtifact, [registry.inner.lockingBytecode], { provider });
    const callerBSetup = await setupStatefulUtxos(
      provider, callerBBase, callerBArtifact.stateLayout!, {}, { saltContract: true },
    );
    const callerB = StatefulContract.withCategory(
      callerBBase.withCategory(hexToBin(callerBSetup.categoryId)), callerBSetup.categoryId,
    );

    const callsiteA = callerAArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'set')!.callsiteId!;
    const callsiteB = callerBArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'set')!.callsiteId!;

    const funderA = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composeA = messageBus.compose({
      preparedCalls: [
        { contract: callerA, functionName: 'poke', args: [2n, 7n] },
        { contract: registry, functionName: 'set', args: [2n, 7n], callsiteId: callsiteA },
      ],
      funder: funderA,
      changeAddress: funderA.unlocker.generateLockingBytecode(),
    });
    const builderA = await composeA.build();
    expect(vmAccepts(builderA)).toBe(true);
    expect(builderA.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === callerA.inner.address)).toBe(true);
    expect(builderA.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry')).toBe(true);
    await expect(composeA.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const funderB = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composeB = messageBus.compose({
      preparedCalls: [
        { contract: callerB, functionName: 'poke', args: [9n, 55n] },
        { contract: registry, functionName: 'set', args: [9n, 55n], callsiteId: callsiteB },
      ],
      funder: funderB,
      changeAddress: funderB.unlocker.generateLockingBytecode(),
    });
    const builderB = await composeB.build();
    expect(vmAccepts(builderB)).toBe(true);
    expect(builderB.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === callerB.inner.address)).toBe(true);
    expect(builderB.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry')).toBe(true);
    await expect(composeB.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const ea = getEntryNftAddress(registry.inner, registrySetup.categoryId, 'bal');
    const entries = SortedList.fromUtxos(await provider.getUtxos(ea));
    const e2 = entries.find(keyToSlot(bigIntToVmNumber(2n)));
    const e9 = entries.find(keyToSlot(bigIntToVmNumber(9n)));
    expect(e2).toBeDefined();
    expect(e9).toBeDefined();
    expect(vmNumberToBigInt(e2!.value, { requireMinimalEncoding: false })).toBe(7n);
    expect(vmNumberToBigInt(e9!.value, { requireMinimalEncoding: false })).toBe(55n);
  }, 180_000);
});
