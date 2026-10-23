import { bigIntToVmNumber, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
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

describe('kernel self vmap RMW', () => {
  it('UPDATE: bal[k] += v on a present entry under KERNEL', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        mapping(uint256 => uint256) bal;
        function seed(uint256 k, uint256 v) public { bal[k] = v; require(true); }
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((h) => h.name === 'credit'))
      .toMatchObject({ eligible: true });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await sc.call.seed(30n, 100n).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = sc.call.credit(30n, 25n);
    call.addInput(funder.utxo, funder.unlocker);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    const route = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && 'params' in input.unlocker);
    expect(route).toBeGreaterThanOrEqual(0);
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(sc.inner, setup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(30n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(125n);
  }, 120_000);

  it('INSERT: bal[k] += v on an absent key mints 0+v under KERNEL', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        mapping(uint256 => uint256) bal;
        function seed(uint256 k, uint256 v) public { bal[k] = v; require(true); }
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await sc.call.seed(2n, 7n).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = sc.call.credit(70n, 7n);
    call.addInput(funder.utxo, funder.unlocker);
    const builder = await call.build();
    expect(vmAccepts(builder)).toBe(true);
    const unlocker = builder.inputs.find((input) => 'contract' in input.unlocker
      && 'params' in input.unlocker)?.unlocker;
    if (!unlocker || !('params' in unlocker)) throw new Error('route missing params');
    const predOutIdx = artifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutIdx).toBeGreaterThanOrEqual(0);
    // Params align with route inputs when the unlocker is the kernel route.
    if (unlocker.params.length === artifact.messageBus!.route.inputs.length) {
      expect(Number(unlocker.params[predOutIdx] as bigint)).toBeGreaterThanOrEqual(0);
    }
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(sc.inner, setup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(70n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(7n);
  }, 120_000);
});
