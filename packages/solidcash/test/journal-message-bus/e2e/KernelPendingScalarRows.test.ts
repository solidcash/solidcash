import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { decodePushdataValue, KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  encodeFunctionArgument,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { decodeKernelEntryJournalAccesses } from '../../../src/stateful/KernelEntryJournal.js';
import { SortedList, bytesToSlotValue, keyToSlot } from '../../../src/stateful/SortedList.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusSemanticTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

/** Entry covenants bind the master's lock: read entries at the category-pinned master's address. */
function pinnedEntryAddress(inner: Contract<any, any>, categoryId: string, collection: string): string {
  return getEntryNftAddress(inner.withCategory(hexToBin(categoryId)), categoryId, collection);
}

const SOURCE = `pragma solidcash ^0.14.0;
contract PendingScalarRows() {
  mapping(int => int) values;
  function addMany(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.values[keys[i]] = this.values[keys[i]] + delta; }
    require(true);
  }
}`;

const DEFAULT_SOURCE = `pragma solidcash ^0.14.0;
contract DefaultScalarRows() {
  mapping(int => int) values;
  function addMany(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.values[keys[i]] = this.values[keys[i]] + delta; }
    require(true);
  }
  function setMany(int[] keys, int value) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.values[keys[i]] = value; }
    require(true);
  }
  function clearMany(int[] keys) public {
    for (int i = 0; i < keys.length; i = i + 1) { delete this.values[keys[i]]; }
    require(true);
  }
}`;

const ABSENT_DELETE_SOURCE = `pragma solidcash ^0.14.0;
contract AbsentDeleteRows() {
  mapping(int => int) values;
  function clearMany(int[] keys) public {
    for (int i = 0; i < keys.length; i = i + 1) { delete this.values[keys[i]]; }
    require(true);
  }
}`;

const EFFECT_SOURCE = `pragma solidcash ^0.14.0;
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

const MULTI_COLLECTION_SOURCE = `pragma solidcash ^0.14.0;
contract PendingScalarCollections() {
  mapping(int => int) left;
  mapping(int => int) right;
  function addLeft(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.left[keys[i]] = this.left[keys[i]] + delta; }
    require(true);
  }
  function addRight(int[] keys, int delta) public {
    for (int i = 0; i < keys.length; i = i + 1) { this.right[keys[i]] = this.right[keys[i]] + delta; }
    require(true);
  }
}`;

const INTERLEAVED_SITE_SOURCE = `pragma solidcash ^0.14.0;
contract InterleavedMappingWrites() {
  mapping(int => int) values;
  function writeBoth(int[] first, int[] second) public {
    for (int i = 0; i < first.length; i = i + 1) {
      this.values[first[i]] = 1;
      this.values[second[i]] = 2;
    }
    require(true);
  }
}`;

describe('kernel pending fixed-width scalar rows', () => {
  it('composes zero writes and present-key deletes without removing list nodes', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(DEFAULT_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const ranked = Array.from({ length: 48 }, (_unused, index) => BigInt(index + 1)).sort((left, right) => {
      const leftSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(left)));
      const rightSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(right)));
      return leftSlot < rightSlot ? -1 : 1;
    });
    const insertedKey = ranked[8];
    const presentKey = ranked[24];
    const absentKey = ranked[44];
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.setMany([presentKey], 9n).send();

    // Explicit assignment may insert a zero-valued enumerable node. Delete nullifies only an entry whose presence
    // is already proven; neither operation requests a physical linked-list splice.
    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'setMany', args: [[insertedKey], 0n] },
      { function: 'clearMany', args: [[presentKey]] },
      { function: 'setMany', args: [[insertedKey], 5n] },
      { function: 'clearMany', args: [[insertedKey]] },
      { function: 'setMany', args: [[presentKey], 2n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toBeDefined();

    const collection = artifact.stateLayout!.collections.find((candidate) => candidate.name === 'values')!;
    const entries = await provider.getUtxos(pinnedEntryAddress(inner, categoryId, collection.signature));
    for (const [key, value] of [[presentKey, 2n], [insertedKey, 0n]] as const) {
      const slot = binToHex(keyToSlot(bigIntToVmNumber(key)));
      const entry = entries.find((candidate) =>
        binToHex(hexToBin(candidate.token!.nft!.commitment).slice(0, 32)) === slot);
      expect(entry, `retained node ${key}`).toBeDefined();
      expect(vmNumberToBigInt(hexToBin(entry!.token!.nft!.commitment).slice(64), {
        requireMinimalEncoding: false,
      })).toBe(value);
    }

    // An absent delete must not create an enumerable zero-valued node. Its predecessor is authenticated and
    // reproduced exactly, so the mapping remains byte-for-byte unchanged.
    await expect(StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'clearMany', args: [[absentKey]] }]).send()).resolves.toBeDefined();
    const afterAbsentDelete = await provider.getUtxos(pinnedEntryAddress(inner, categoryId, collection.signature));
    expect(afterAbsentDelete.map((entry) => entry.token!.nft!.commitment).sort())
      .toEqual(entries.map((entry) => entry.token!.nft!.commitment).sort());
  }, 180_000);

  it('omits an absent-key delete without creating an enumerable node', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(ABSENT_DELETE_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'clearMany', args: [[9n]] }]);
    const builder = await call.build();
    const routeInput = builder.inputs.find((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus?.route.name);
    expect(routeInput).toBeDefined();
    if (!routeInput || !('params' in routeInput.unlocker)) throw new Error('kernel route has no parameters');
    const journalIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    expect(journalIndex).toBeGreaterThanOrEqual(0);
    const rowStreams = routeInput.unlocker.params[journalIndex] as Uint8Array[][];
    expect(rowStreams.flatMap((streams) => streams.flatMap(decodeKernelEntryJournalAccesses)))
      .toEqual([expect.objectContaining({
        presentBefore: false,
        presentAfter: false,
        mutates: true,
        authenticatesPredecessor: true,
      })]);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toBeDefined();
    const entryAddress = pinnedEntryAddress(inner, categoryId, 'values');
    expect(SortedList.fromUtxos(await provider.getUtxos(entryAddress)).all
      .map((entry) => bytesToSlotValue(entry.slot))).toEqual([0n]);
  }, 180_000);

  it('settles an inserted node before a later row updates its dirty predecessor', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(DEFAULT_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const ranked = Array.from({ length: 48 }, (_unused, index) => BigInt(index + 1)).sort((left, right) => {
      const leftSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(left)));
      const rightSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(right)));
      return leftSlot < rightSlot ? -1 : 1;
    });
    const predecessorKey = ranked[24];
    const insertedKey = ranked[40];
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.setMany([predecessorKey], 9n).send();

    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'setMany', args: [[insertedKey], 5n] },
      { function: 'clearMany', args: [[predecessorKey]] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toBeDefined();

    const collection = artifact.stateLayout!.collections.find((candidate) => candidate.name === 'values')!;
    const entries = await provider.getUtxos(pinnedEntryAddress(inner, categoryId, collection.signature));
    for (const [key, value] of [[predecessorKey, 0n], [insertedKey, 5n]] as const) {
      const slot = binToHex(keyToSlot(bigIntToVmNumber(key)));
      const entry = entries.find((candidate) =>
        binToHex(hexToBin(candidate.token!.nft!.commitment).slice(0, 32)) === slot);
      expect(entry).toBeDefined();
      expect(vmNumberToBigInt(hexToBin(entry!.token!.nft!.commitment).slice(64), {
        requireMinimalEncoding: false,
      })).toBe(value);
    }
  }, 180_000);

  it('chains insertions and updates across rows without crossing an authenticated successor', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const ranked = Array.from({ length: 48 }, (_unused, index) => BigInt(index + 1)).sort((left, right) => {
      const leftSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(left)));
      const rightSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(right)));
      return leftSlot < rightSlot ? -1 : 1;
    });
    const low = ranked[8];
    const lowNext = ranked[12];
    const boundary = ranked[24];
    const high = ranked[40];
    const initial = StatefulContract.withCategory(inner, categoryId);
    await initial.call.addMany([boundary], 1n).send();

    const current = StatefulContract.withCategory(inner, categoryId);
    const call = current.batch([
      { function: 'addMany', args: [[low], 4n] },
      { function: 'addMany', args: [[lowNext], 5n] },
      { function: 'addMany', args: [[high], 3n] },
      { function: 'addMany', args: [[low], 2n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const routeInputIndex = builder.inputs.findIndex((input) => 'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus?.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeInput = builder.inputs[routeInputIndex];
    if (!('params' in routeInput.unlocker)) throw new Error('kernel route has no parameterized unlocker');
    const journalIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === '__internal__kernelJournalAccessStreams');
    const rowStreams = routeInput.unlocker.params[journalIndex] as Uint8Array[][];
    const decodedRowAccesses = rowStreams.flatMap((streams) =>
      streams.flatMap((stream) => decodeKernelEntryJournalAccesses(stream)));
    expect(decodedRowAccesses.filter((access) => access.mutates).every((access) => access.pending)).toBe(true);
    const pendingRowIndex = rowStreams.findIndex((streams) => streams.some((stream) =>
      decodeKernelEntryJournalAccesses(stream).some((access) => !access.presentBefore
        && access.predecessorRecordOrdinal !== undefined && !access.authenticatesPredecessor)));
    expect(pendingRowIndex).toBeGreaterThanOrEqual(0);
    const pendingStreamIndex = rowStreams[pendingRowIndex].findIndex((stream) =>
      decodeKernelEntryJournalAccesses(stream).some((access) => !access.presentBefore
        && access.predecessorRecordOrdinal !== undefined && !access.authenticatesPredecessor));
    const routeSucceeds = (candidate: typeof transaction): boolean => vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: candidate,
    })) === true;
    const originalUnlocker = routeInput.unlocker;
    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('kernel route has no selector');
    for (const [label, mutate] of [
      ['aliased pending predecessor ordinal', (stream: Uint8Array) => {
        stream[25] = stream[23]; stream[26] = stream[24];
      }],
      ['false physical predecessor authentication', (stream: Uint8Array) => { stream[22] |= 0x20; }],
    ] as const) {
      const hostileRows = rowStreams.map((streams) => streams.map((stream) => new Uint8Array(stream)));
      mutate(hostileRows[pendingRowIndex][pendingStreamIndex]);
      const hostileParams = [...originalUnlocker.params];
      hostileParams[journalIndex] = hostileRows;
      routeInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
        originalUnlocker.abiFunction, hexToBin(routeSelector),
      )(...hostileParams);
      expect(routeSucceeds(builder.buildLibauthTransaction()), label).toBe(false);
    }
    const pendingAccess = decodeKernelEntryJournalAccesses(rowStreams[pendingRowIndex][pendingStreamIndex])
      .find((access) => !access.presentBefore && !access.authenticatesPredecessor)!;
    const highRowIndex = 2;
    const highStreamIndex = rowStreams[highRowIndex].findIndex((stream) =>
      decodeKernelEntryJournalAccesses(stream).some((access) => !access.presentBefore
        && access.authenticatesPredecessor));
    expect(highStreamIndex).toBeGreaterThanOrEqual(0);
    const crossGapRows = rowStreams.map((streams) => streams.map((stream) => new Uint8Array(stream)));
    const crossGapStream = crossGapRows[highRowIndex][highStreamIndex];
    crossGapStream[22] &= ~0x20;
    crossGapStream[25] = pendingAccess.targetRecordOrdinal & 0xff;
    crossGapStream[26] = pendingAccess.targetRecordOrdinal >>> 8;
    const crossGapParams = [...originalUnlocker.params];
    crossGapParams[journalIndex] = crossGapRows;
    routeInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(routeSelector),
    )(...crossGapParams);
    expect(routeSucceeds(builder.buildLibauthTransaction()), 'pending predecessor outside its open successor interval')
      .toBe(false);
    routeInput.unlocker = originalUnlocker;
    await expect(call.send()).resolves.toBeDefined();
    const entryAddress = pinnedEntryAddress(
      inner, categoryId, artifact.stateLayout!.collections.find((candidate) => candidate.name === 'values')!.signature,
    );
    const settledEntries = await provider.getUtxos(entryAddress);
    for (const [key, expected] of [[low, 6n], [lowNext, 5n], [boundary, 1n], [high, 3n]] as const) {
      const entry = settledEntries.find((utxo) =>
        binToHex(hexToBin(utxo.token!.nft!.commitment).slice(0, 32)) === binToHex(keyToSlot(bigIntToVmNumber(key))));
      expect(vmNumberToBigInt(hexToBin(entry!.token!.nft!.commitment).slice(64), {
        requireMinimalEncoding: false,
      })).toBe(expected);
    }
  }, 180_000);

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
    const entryLock = addressToLockScript(pinnedEntryAddress(inner, categoryId, collection.signature));
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
      input.name === `${KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX}0`);
    const originalUnlocker = routeInput.unlocker;
    const hostileParams = [...originalUnlocker.params];
    const encodedCarrier = originalUnlocker.params[recordIndex] as Uint8Array;
    const records = decodePushdataValue(encodedCarrier, 0, 'bytes[]').value as Uint8Array[];
    const dirtyAtEntry = records.map((record, index) => {
      const copy = new Uint8Array(record);
      if (index === 0) copy[1] = 0x03;
      return copy;
    });
    hostileParams[recordIndex] = encodeFunctionArgument(
      dirtyAtEntry, 'bytes[]', artifact.stateLayout!.structs,
    ) as Uint8Array;
    routeInput.unlocker = originalUnlocker.contract.createCompilerRouteUnlocker(
      originalUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector),
    )(...hostileParams);
    expect(routeSucceeds(builder.buildLibauthTransaction()), 'caller-supplied dirty carrier').toBe(false);
    routeInput.unlocker = originalUnlocker;

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
    expect(binToHex(emptyCarrier.data)).toBe('00');
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

  it('settles interleaved collections in global journal ordinal order', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(MULTI_COLLECTION_SOURCE, KERNEL);
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const ranked = Array.from({ length: 48 }, (_unused, index) => BigInt(index + 1)).sort((left, right) => {
      const leftSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(left)));
      const rightSlot = bytesToSlotValue(keyToSlot(bigIntToVmNumber(right)));
      return leftSlot < rightSlot ? -1 : 1;
    });
    const leftLow = ranked[8];
    const leftNext = ranked[12];
    const leftBoundary = ranked[24];
    const contract = StatefulContract.withCategory(inner, categoryId);
    await contract.call.addLeft([leftBoundary], 1n).send();

    const call = StatefulContract.withCategory(inner, categoryId).batch([
      { function: 'addLeft', args: [[leftLow], 2n] },
      { function: 'addRight', args: [[1n], 3n] },
      { function: 'addLeft', args: [[leftNext], 4n] },
    ]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    await expect(call.send()).resolves.toBeDefined();

    for (const [collectionName, expected] of [
      ['left', [[leftLow, 2n], [leftNext, 4n], [leftBoundary, 1n]]],
      ['right', [[1n, 3n]]],
    ] as const) {
      const collection = artifact.stateLayout!.collections.find((candidate) => candidate.name === collectionName)!;
      const settledEntries = await provider.getUtxos(pinnedEntryAddress(inner, categoryId, collection.signature));
      for (const [key, value] of expected) {
        const entry = settledEntries.find((utxo) =>
          binToHex(hexToBin(utxo.token!.nft!.commitment).slice(0, 32)) === binToHex(keyToSlot(bigIntToVmNumber(key))));
        expect(vmNumberToBigInt(hexToBin(entry!.token!.nft!.commitment).slice(64), {
          requireMinimalEncoding: false,
        })).toBe(value);
      }
    }
  }, 180_000);

  it('refuses interleaved write sites whose topology materialization crosses streams', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const artifact = compileString(INTERLEAVED_SITE_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeBoth'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    expect(() => StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeBoth', args: [[1n, 3n], [2n, 4n]] }]))
      .toThrow(/not batch eligible: KERNEL_LAYOUT/);
  }, 180_000);

  it('settles mixed scalar insertion topology and requires published segments above one BCH stack item', async () => {
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
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 6n], 1n] }]).send())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 1n, 2n, 3n, 4n], 1n] }]).build())
      .resolves.toBeDefined();
    await expect(contract.batch([{ function: 'addMany', args: [[0n, 1n, 2n, 3n, 4n, 5n], 1n] }]).send())
      .resolves.toBeDefined();
    const collection = artifact.stateLayout!.collections.find((candidate) => candidate.name === 'values')!;
    const entries = await provider.getUtxos(pinnedEntryAddress(inner, categoryId, collection.signature));
    for (let key = 0n; key < 6n; key += 1n) {
      const entry = entries.find((utxo) =>
        binToHex(hexToBin(utxo.token!.nft!.commitment).slice(0, 32)) === binToHex(keyToSlot(bigIntToVmNumber(key))));
      expect(vmNumberToBigInt(hexToBin(entry!.token!.nft!.commitment).slice(64), {
        requireMinimalEncoding: false,
      })).toBe(key === 0n ? 3n : 2n);
    }
  }, 180_000);

  it('admits one event-bearing mutation row and fences repeated rows at composition', async () => {
    const provider = createTestProvider();
    const artifact = compileString(EFFECT_SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'addMany'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    await expect(contract.batch([{ function: 'addMany', args: [[0n], 1n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(() => contract.batch([
      { function: 'addMany', args: [[0n], 1n] },
      { function: 'addMany', args: [[1n], 2n] },
    ])).toThrow(/Multiple message-bus runtime event rows with journal mutations/);
  }, 180_000);
});
