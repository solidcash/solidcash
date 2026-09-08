import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, encodeFunctionArgument } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const SOURCE = `pragma solidcash ^0.13.0;
contract PendingScalarRows() {
  mapping(int => int) values;
  function addMany(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.values[keys[i]] = this.values[keys[i]] + delta; }
    require(true);
  }
}`;

const EFFECT_SOURCE = `pragma solidcash ^0.13.0;
contract PendingScalarEffectFence() {
  mapping(int => int) values;
  event Hit(int key);
  function addMany(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) {
      this.values[keys[i]] = this.values[keys[i]] + delta;
      emit Hit(keys[i]);
    }
    require(true);
  }
}`;

describe('kernel pending fixed-width scalar rows', () => {
  it('settles same present keys once across source-ordered rows', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const initial = StatefulContract.withCategory(inner, categoryId);
    await expect(initial.call.addMany([0n, 1n], 4n).send()).resolves.toBeDefined();

    const current = StatefulContract.withCategory(inner, categoryId);
    const call = current.batch([
      { function: 'addMany', args: [[0n, 1n], 6n] },
      { function: 'addMany', args: [[0n, 1n], 3n] },
    ]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus?.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeInput = builder.inputs[routeInputIndex];
    if (!('params' in routeInput.unlocker)) throw new Error('kernel route has no parameterized unlocker');
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    expect(transaction.inputs[routeInputIndex].unlockingBytecode.length).toBeLessThanOrEqual(10_000);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      expect(vm.stateSuccess(state), `input ${inputIndex}`)
        .toBe(true);
    }

    const collection = artifact.stateLayout!.collections.find((candidate) => candidate.name === 'values')!;
    const entryLock = addressToLockScript(getEntryNftAddress(inner, categoryId, collection.signature));
    const entryOutputs = transaction.outputs.filter((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.lockingBytecode) === binToHex(entryLock));
    expect(entryOutputs).toHaveLength(2);
    expect(entryOutputs.map((output) => vmNumberToBigInt(output.token!.nft!.commitment.slice(64), {
      requireMinimalEncoding: false,
    }))).toEqual([13n, 13n]);

    const routeSucceeds = (candidate: typeof transaction): boolean => vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: candidate,
    })) === true;
    const replaceValue = (commitment: Uint8Array, value: bigint): Uint8Array => new Uint8Array([
      ...commitment.slice(0, 64), ...bigIntToVmNumber(value),
    ]);
    for (const hostileValue of [4n, 10n]) {
      const hostile = structuredClone(transaction);
      const output = hostile.outputs.find((candidate) => candidate.token?.nft?.capability === 'mutable'
        && binToHex(candidate.lockingBytecode) === binToHex(entryLock))!;
      output.token!.nft!.commitment = replaceValue(output.token!.nft!.commitment, hostileValue);
      expect(routeSucceeds(hostile), `hostile ${hostileValue === 4n ? 'stale' : 'intermediate'} output`).toBe(false);
    }
    const omitted = structuredClone(transaction);
    omitted.outputs.splice(omitted.outputs.findIndex((candidate) => candidate.token?.nft?.capability === 'mutable'
      && binToHex(candidate.lockingBytecode) === binToHex(entryLock)), 1);
    expect(routeSucceeds(omitted), 'omitted final output').toBe(false);
    const duplicated = structuredClone(transaction);
    duplicated.outputs.push(structuredClone(entryOutputs[0]));
    expect(routeSucceeds(duplicated), 'duplicate final output').toBe(false);
    const intermediate = structuredClone(transaction);
    const extraIntermediate = structuredClone(entryOutputs[0]);
    extraIntermediate.token!.nft!.commitment = replaceValue(extraIntermediate.token!.nft!.commitment, 10n);
    intermediate.outputs.push(extraIntermediate);
    expect(routeSucceeds(intermediate), 'extra intermediate output').toBe(false);

    const recordIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalRecords');
    const originalUnlocker = routeInput.unlocker;
    const hostileParams = [...originalUnlocker.params];
    const records = originalUnlocker.params[recordIndex] as Uint8Array[];
    const dirtyAtEntry = records.map((record, index) => {
      const copy = new Uint8Array(record);
      if (index === 0) copy[1] = 0x03;
      return copy;
    });
    hostileParams[recordIndex] = dirtyAtEntry;
    routeInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector),
    )(...hostileParams);
    expect(routeSucceeds(builder.buildLibauthTransaction()), 'caller-supplied dirty carrier').toBe(false);
    routeInput.unlocker = originalUnlocker;

    const encodedCarrier = encodeFunctionArgument(records, 'bytes[]') as Uint8Array;
    const carrierInstructions = decodeAuthenticationInstructions(transaction.inputs[routeInputIndex].unlockingBytecode);
    const carrierInstructionIndex = carrierInstructions.findIndex((instruction) => 'data' in instruction
      && binToHex(instruction.data) === binToHex(encodedCarrier));
    expect(carrierInstructionIndex).toBeGreaterThanOrEqual(0);
    const trailingFrame = new Uint8Array([0x4c, records[0].length, ...records[0]]);
    const trailingDirty = structuredClone(transaction);
    const trailingDirtyInstructions = decodeAuthenticationInstructions(
      trailingDirty.inputs[routeInputIndex].unlockingBytecode,
    );
    const carrierInstruction = trailingDirtyInstructions[carrierInstructionIndex];
    if (!('data' in carrierInstruction)) throw new Error('kernel carrier is not a pushed item');
    trailingDirtyInstructions[carrierInstructionIndex] = {
      ...carrierInstruction, data: new Uint8Array([...carrierInstruction.data, ...trailingFrame]),
    };
    trailingDirty.inputs[routeInputIndex].unlockingBytecode = encodeAuthenticationInstructions(
      trailingDirtyInstructions,
    );
    expect(routeSucceeds(trailingDirty), 'dirty carrier trailing frame').toBe(false);

    const emptyCall = current.batch([{ function: 'addMany', args: [[], 1n] }]);
    const emptyBuilder = await emptyCall.build();
    const emptyRouteIndex = emptyBuilder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus?.route.name);
    const emptyTx = emptyBuilder.buildLibauthTransaction();
    const emptyInstructions = decodeAuthenticationInstructions(emptyTx.inputs[emptyRouteIndex].unlockingBytecode);
    const emptyCarrier = emptyInstructions[carrierInstructionIndex];
    if (!('data' in emptyCarrier)) throw new Error('empty kernel carrier is not a pushed item');
    expect(binToHex(emptyCarrier.data)).toBe(binToHex(encodeFunctionArgument([], 'bytes[]') as Uint8Array));
    emptyInstructions[carrierInstructionIndex] = {
      ...emptyCarrier, data: new Uint8Array([...emptyCarrier.data, ...trailingFrame]),
    };
    emptyTx.inputs[emptyRouteIndex].unlockingBytecode = encodeAuthenticationInstructions(emptyInstructions);
    const emptyVm = createVirtualMachineBch2026ForProvider(provider);
    expect(emptyVm.stateSuccess(emptyVm.evaluate({
      inputIndex: emptyRouteIndex,
      sourceOutputs: generateLibauthSourceOutputs(emptyBuilder.inputs),
      transaction: emptyTx,
    })), 'unchanged carrier trailing frame').not.toBe(true);

    await expect(call.send()).resolves.toBeDefined();

    // Duplicate keys in one handler consume the same pre-state entry once and apply both source occurrences.
    const duplicate = StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'addMany', args: [[0n, 0n], 2n] }]);
    const duplicateBuilder = await duplicate.build();
    const duplicateTx = duplicateBuilder.buildLibauthTransaction();
    const duplicateEntries = duplicateTx.outputs.filter((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.lockingBytecode) === binToHex(entryLock));
    expect(duplicateEntries).toHaveLength(1);
    expect(vmNumberToBigInt(duplicateEntries[0].token!.nft!.commitment.slice(64), {
      requireMinimalEncoding: false,
    })).toBe(17n);
    await expect(duplicate.send()).resolves.toBeDefined();

    // Retarget pending references through more than one commitment-array merge: A, then (A,B), then A again.
    const threeRows = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'addMany', args: [[0n], 1n] },
      { function: 'addMany', args: [[0n, 1n], 2n] },
      { function: 'addMany', args: [[0n], 4n] },
    ]);
    const threeBuilder = await threeRows.build();
    const threeTx = threeBuilder.buildLibauthTransaction();
    const threeEntries = threeTx.outputs.filter((output) => output.token?.nft?.capability === 'mutable'
      && binToHex(output.lockingBytecode) === binToHex(entryLock));
    expect(threeEntries.map((output) => vmNumberToBigInt(output.token!.nft!.commitment.slice(64), {
      requireMinimalEncoding: false,
    }))).toEqual([24n, 15n]);
    await expect(threeRows.send()).resolves.toBeDefined();
  }, 180_000);

  it('rejects mixed topology and carriers above one BCH stack item', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    for (let key = 0n; key < 6n; key += 1n) {
      await contract.call.addMany([key], 1n).send();
    }
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 6n], 1n] }]).build())
      .rejects.toThrow(/cannot mix existing-entry updates with reads, inserts, removals, or predecessor rewrites/);
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 1n, 2n, 3n, 4n], 1n] }]).build())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 1n, 2n, 3n, 4n, 5n], 1n] }]).build())
      .rejects.toThrow(/exceeding the 520-byte BCH stack-item limit/);
  }, 180_000);

  it('rejects pending settlement mixed with runtime effect output segments', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECT_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.addMany([0n], 1n).send();
    await expect(contract.batch([
      { function: 'addMany', args: [[0n], 1n] },
      { function: 'addMany', args: [[0n], 1n] },
    ]).build()).rejects.toThrow(/cannot share a transaction with runtime event or transfer output segments/);
  }, 180_000);
});
