import {
  bigIntToVmNumber, binToHex, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { resolveParticipantAbsoluteWitnesses } from '../../../src/message-bus/layout-resolver.js';
import { SCRIPT_INACTIVE } from '../../../src/message-bus/layout-sentinels.js';
import {
  bytesToSlotValue, decodeEntryCommitment, keyToSlot,
} from '../../../src/stateful/SortedList.js';
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
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => {
      try {
        const result = vm.evaluate({ inputIndex, sourceOutputs, transaction });
        return vm.stateSuccess(result) === true;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

/**
 * transaction layout authority plan step 2 (compose half): messageBus.compose fills unlocker valueChunk/PredOut through
 * resolveParticipantAbsoluteWitnesses + applyParticipantAbsoluteWitnesses in compose.ts.
 */
describe('kernel compose layout witnesses', () => {
  it('fills Store unlocker valueChunk (+PredOut when active) matching one layout resolve', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) data;
        function set(int key, bytes value) public {
          this.data[key] = value;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.handlers?.find((h) => h.name === 'set'))
      .toMatchObject({ eligible: true });
    expect(storeArtifact.messageBus!.route.inputs.some((i) => i.name === '__internal__valueChunkOutputBase'))
      .toBe(true);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function set(int key, bytes value) external; }
      contract Caller() {
        function poke(address store, int key, bytes value) public {
          IStore(store).set(key, value);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'set');
    expect(callsite?.callsiteId).toBeDefined();

    // Seed so the large write is an UPDATE with value chunks (PredOut may stay inactive).
    const seed = new Uint8Array(20).fill(0x01);
    await expect(store.call.set(3n, seed).send()).resolves.toBeDefined();

    const payload = new Uint8Array(130).fill(0x71);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 3n, payload],
      }, {
        contract: store,
        functionName: 'set',
        args: [3n, payload],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const storeRouteIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Store'
      && input.unlocker.abiFunction.name === storeArtifact.messageBus!.route.name);
    expect(storeRouteIndex).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[storeRouteIndex]!.unlocker;
    if (!('params' in unlocker) || !('abiFunction' in unlocker)) {
      throw new Error('store route unlocker missing params');
    }

    const valueChunkIndex = unlocker.abiFunction.inputs.findIndex((input: { name: string }) =>
      input.name === '__internal__valueChunkOutputBase');
    expect(valueChunkIndex).toBeGreaterThanOrEqual(0);
    const filledValueChunk = Number(unlocker.params[valueChunkIndex] as bigint);
    expect(filledValueChunk).toBeGreaterThanOrEqual(0);

    const blockLayout = storeArtifact.messageBus?.route?.blockLayout;
    const trailingBase = blockLayout?.trailingBase;
    expect(typeof trailingBase).toBe('number');
    // Continuation band[0] sits at trailingBase when there is no dyn run (compose claim bandOffset 0).
    // Expected absolutes come from published geometry only — never reverse-engineered from filled params.
    const expected = resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase: storeRouteIndex,
      blockSize: Math.max(blockLayout?.blockSize ?? 0, (trailingBase as number) + 1),
      trailingBase: trailingBase as number,
      trailingCapacity: blockLayout?.trailingCapacity,
      dynChunkCount: undefined,
      valueChunkBandOffset: 0,
      valueChunkCollection: 'data',
      valueChunkCount: 1,
    });
    expect(unlocker.params[valueChunkIndex]).toBe(expected.valueChunkOutputBase);
    expect(Number(unlocker.params[valueChunkIndex])).toBe(storeRouteIndex + (trailingBase as number));

    // PredOut stays inactive on this UPDATE shape — covered by the INSERT case below.
    const predOutIndex = unlocker.abiFunction.inputs.findIndex((input: { name: string }) =>
      /^__internal__vmapBatchPredOut_\d+$/.test(input.name));
    if (predOutIndex >= 0) {
      expect(Number(unlocker.params[predOutIndex] as bigint)).toBe(SCRIPT_INACTIVE);
    }

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entries = await store.getEntries('data');
    const { keyToSlotMulti } = await import('../../../src/stateful/SortedList.js');
    const slot = binToHex(keyToSlotMulti([bigIntToVmNumber(3n)]));
    expect(entries.find((entry) => binToHex(entry.slot) === slot)?.value).toEqual(payload);
  }, 300_000);

  it('fills Registry unlocker PredOut on INSERT matching one layout resolve (physical absolute)', async () => {
    // transaction layout authority PredOut half: INSERT activates PredOut=P. Physical offset comes from scanning
    // published outputs for the predecessor rewrite — not from unlocker.params (avoids 203↔222 theater).
    const provider = createMessageBusCapstoneTestProvider();
    const registryArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Registry() {
        mapping(int => int) bal;
        function set(int k, int v) public {
          this.bal[k] = v;
          require(true);
        }
      }`, KERNEL);
    expect(registryArtifact.messageBus!.route.inputs.some(
      (input) => /^__internal__vmapBatchPredOut_\d+$/.test(input.name),
    )).toBe(true);

    const registryBase = new Contract(registryArtifact, [], { provider });
    const registrySetup = await setupStatefulUtxos(
      provider, registryBase, registryArtifact.stateLayout!, {}, { saltContract: true },
    );
    const registry = StatefulContract.withCategory(
      registryBase.withCategory(hexToBin(registrySetup.categoryId)), registrySetup.categoryId,
    );

    // Seed predecessor key; compose INSERTs a higher key so PredOut rewrites P.next → inserted.
    await expect(registry.call.set(2n, 7n).send()).resolves.toBeDefined();

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IRegistry { function set(int k, int v) external; }
      contract Caller() {
        function poke(address registry, int k, int v) public {
          IRegistry(registry).set(k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IRegistry', registry);

    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'set');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [registry.inner.lockingBytecode, 9n, 55n],
      }, {
        contract: registry,
        functionName: 'set',
        args: [9n, 55n],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const registryRouteIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry'
      && input.unlocker.abiFunction.name === registryArtifact.messageBus!.route.name);
    expect(registryRouteIndex).toBeGreaterThanOrEqual(0);
    const unlocker = builder.inputs[registryRouteIndex]!.unlocker;
    if (!('params' in unlocker) || !('abiFunction' in unlocker)) {
      throw new Error('registry route unlocker missing params');
    }

    const predOutIndex = unlocker.abiFunction.inputs.findIndex((input: { name: string }) =>
      /^__internal__vmapBatchPredOut_\d+$/.test(input.name));
    expect(predOutIndex).toBeGreaterThanOrEqual(0);
    const predOutName = unlocker.abiFunction.inputs[predOutIndex]!.name;
    const filledPred = Number(unlocker.params[predOutIndex] as bigint);
    expect(filledPred).toBeGreaterThanOrEqual(0);

    const transaction = builder.buildLibauthTransaction();
    const seededSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(2n)));
    const insertedSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(9n)));
    const categoryHex = registrySetup.categoryId.toLowerCase();
    const predOutPhysicalAbsolute = transaction.outputs.findIndex((output) => {
      if (output.token?.nft?.capability !== 'mutable') return false;
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      if (hex !== categoryHex) return false;
      try {
        const decoded = decodeEntryCommitment(
          typeof output.token.nft.commitment === 'string'
            ? hexToBin(output.token.nft.commitment)
            : output.token.nft.commitment,
        );
        return bytesToSlotValue(decoded.slot) === seededSlot
          && bytesToSlotValue(decoded.nextKey) === insertedSlot;
      } catch {
        return false;
      }
    });
    expect(predOutPhysicalAbsolute).toBeGreaterThanOrEqual(0);
    const physicalLocalOffset = predOutPhysicalAbsolute - registryRouteIndex;
    expect(physicalLocalOffset).toBeGreaterThanOrEqual(0);

    const blockLayout = registryArtifact.messageBus?.route?.blockLayout;
    const trailingBase = blockLayout?.trailingBase;
    expect(typeof trailingBase).toBe('number');
    const expected = resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase: registryRouteIndex,
      blockSize: Math.max(
        blockLayout?.blockSize ?? 0,
        physicalLocalOffset + 1,
        (trailingBase as number) + 1,
      ),
      trailingBase: trailingBase as number,
      trailingCapacity: blockLayout?.trailingCapacity,
      predOuts: [{
        witnessName: predOutName,
        physicalLocalOffset,
      }],
    });
    expect(unlocker.params[predOutIndex]).toBe(expected.predOuts.get(predOutName));
    expect(unlocker.params[predOutIndex]).toBe(BigInt(predOutPhysicalAbsolute));
    // R5/layout-sentinel / PredOut: disagreeing concreteLocalSlot is refused (no longer silently ignored above trailing).
    expect(() => resolveParticipantAbsoluteWitnesses({
      participant: 0,
      publishedBase: registryRouteIndex,
      blockSize: Math.max(
        blockLayout?.blockSize ?? 0,
        physicalLocalOffset + 1,
        (trailingBase as number) + 1,
      ),
      trailingBase: trailingBase as number,
      trailingCapacity: blockLayout?.trailingCapacity,
      predOuts: [{
        witnessName: predOutName,
        physicalLocalOffset,
        concreteLocalSlot: 4,
      }],
    })).toThrow(/pred-out-concrete-vs-physical/);
    // Must use physical, not concrete+publishedBase (203↔222 class).
    expect(unlocker.params[predOutIndex]).not.toBe(BigInt(registryRouteIndex + 4));

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);
});
