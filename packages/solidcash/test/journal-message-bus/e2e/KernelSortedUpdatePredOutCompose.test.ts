import {
  bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt,
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

const commitmentHex = (commitment: Uint8Array | string | undefined): string => {
  if (commitment === undefined) return '';
  return typeof commitment === 'string' ? commitment.toLowerCase() : binToHex(commitment).toLowerCase();
};

describe('kernel sorted-update PredOut under composition', () => {
  it('keeps a shared target predecessor inactive beside another collection insert', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Ledger {
        mapping(uint256 => uint256) balances;
        mapping(uint256 => uint256) records;
        function seed(uint256 from, uint256 value) public {
          balances[from] = value;
          require(true);
        }
        function record(uint256 key, uint256 value) public {
          records[key] = value;
          require(true);
        }
        function move(uint256 from, uint256 to, uint256 value) public {
          balances[from] = balances[from] - value;
          balances[to] = balances[to] + value;
          require(true);
        }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const ledger = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    // In sorted-key order, the existing source is also the absent destination's predecessor.
    const [from, to] = [2n, 9n].sort((left, right) => (
      bytesToSlotValue(keyToSlot(bigIntToVmNumber(left))) < bytesToSlotValue(keyToSlot(bigIntToVmNumber(right)))
        ? -1 : 1
    ));
    await ledger.call.seed(from, 100n).send();
    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILedger {
        function move(uint256 from, uint256 to, uint256 value) external;
        function record(uint256 key, uint256 value) external;
      }
      contract Caller(address ledger) {
        function run(uint256 from, uint256 to, uint256 value) public {
          ILedger(ledger).record(to, value);
          ILedger(ledger).move(from, to, value);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [ledger.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      calls: [caller.call.run(from, to, 7n), ledger.call.record(to, 7n), ledger.call.move(from, to, 7n)],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);
    const route = artifact.messageBus!.route;
    const unlocker = builder.inputs.find((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Ledger')!.unlocker;
    if (!('params' in unlocker)) throw new Error('route input has no parameters');
    const balanceLanes = route.entryAccesses!.filter((candidate) => candidate.collection === 'balances');
    const predOuts = balanceLanes.map((entry) => {
      const index = route.inputs.findIndex((input) => input.name === `__internal__vmapBatchPredOut_${entry.slotIndex}`);
      return unlocker.params[index];
    });
    // Two reached writes update/chain through the existing proof. Compiler-published pooled sibling lanes
    // are inactive in this envelope and must carry -2, not an invented predecessor-output coordinate.
    expect(predOuts.slice(0, 2)).toEqual([-1n, -1n]);
    expect(predOuts.length).toBeGreaterThan(2);
    expect(predOuts.slice(2).every((value) => value === -2n)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await ledger.getEntries('balances');
    expect(entries.find((entry) => binToHex(entry.slot) === binToHex(keyToSlot(bigIntToVmNumber(from))))?.value)
      .toBe(93n);
    expect(entries.find((entry) => binToHex(entry.slot) === binToHex(keyToSlot(bigIntToVmNumber(to))))?.value)
      .toBe(7n);
  }, 180_000);

  it('UPDATE: PredOut inactive; rewritten entry content-matches slot/next/value', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const registryArtifact = compileString(`pragma solidity ^0.8.0;
      contract Registry {
        mapping(uint256 => uint256) bal;
        function set(uint256 k, uint256 v) public { bal[k] = v; require(true); }
      }`, KERNEL);
    expect(registryArtifact.messageBus?.route.inputs.some(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    )).toBe(true);

    const registryBase = new Contract(registryArtifact, [], { provider });
    const registrySetup = await setupStatefulUtxos(
      provider, registryBase, registryArtifact.stateLayout!, {}, { saltContract: true },
    );
    const registry = StatefulContract.withCategory(
      registryBase.withCategory(hexToBin(registrySetup.categoryId)), registrySetup.categoryId,
    );

    // Seed the key that will be UPDATEd (present entry), plus a higher neighbor so PredOut is unambiguous.
    await registry.call.set(2n, 7n).send();
    await registry.call.set(9n, 1n).send();

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IRegistry { function set(uint256 k, uint256 v) external; }
      contract Caller(address registry) {
        function poke(uint256 k, uint256 v) public {
          IRegistry(registry).set(k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [registry.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const callsiteId = callerArtifact.abi.find((entry) => entry.name === 'poke')!
      .externalCalls!.find((call) => call.functionName === 'set')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'poke', args: [2n, 55n] },
        { contract: registry, functionName: 'set', args: [2n, 55n], callsiteId },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry'
      && input.unlocker.abiFunction.name === registryArtifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('registry route input has no parameters');

    const predOutWitnessIndex = registryArtifact.messageBus!.route.inputs.findIndex(
      (input) => input.name === '__internal__vmapBatchPredOut_0',
    );
    expect(predOutWitnessIndex).toBeGreaterThanOrEqual(0);
    const predOutAbsolute = Number(routeUnlocker.params[predOutWitnessIndex] as bigint);
    // Pure value UPDATE of a present key (next pointer unchanged) leaves PredOut inactive.
    // INSERT uses PredOut=P; UPDATE authenticates via exact rewritten entry content-match instead.
    expect(predOutAbsolute).toBe(-1);

    const transaction = builder.buildLibauthTransaction();
    const updatedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const neighborSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));
    const rewrittenIndex = transaction.outputs.findIndex((output) => {
      if (output.token?.nft?.capability !== 'mutable') return false;
      try {
        const decoded = decodeEntryCommitment(
          typeof output.token.nft.commitment === 'string'
            ? hexToBin(output.token.nft.commitment)
            : output.token.nft.commitment,
        );
        return bytesToSlotValue(decoded.slot) === updatedSlot
          && bytesToSlotValue(decoded.nextKey) === neighborSlot
          && vmNumberToBigInt(decoded.value, { requireMinimalEncoding: false }) === 55n;
      } catch {
        return false;
      }
    });
    expect(rewrittenIndex).toBeGreaterThanOrEqual(0);
    expect(commitmentHex(transaction.outputs[rewrittenIndex].token?.nft?.commitment).length)
      .toBeGreaterThan(0);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(registry.inner, registrySetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(55n);
  }, 180_000);
});
