import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { messageBusVerifierCommitment } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  TransactionBuilder,
} from '../../../src/index.js';
import {
  bytesToSlotValue,
  encodeEntryCommitment,
  slotValueToBytes,
  StatefulContract,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  getEntryNftAddress, getEventNftAddress, getMessageBusVerifierAddress,
} from '../../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('affine recursive mapping streams', () => {
  it('fences disjoint post-recursion streams which lack shared settlement geometry', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract DisjointUnwind(bytes densityPadding) {
      mapping(int => int) values;
      function apply(int cursor) public returns (int) {
        if (cursor == 0) return 0;
        int result = apply(cursor - 1);
        this.values[cursor] = cursor + 10;
        this.values[cursor + 64] = cursor + 20;
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!handler?.eligible) return;
    const inner = new Contract(artifact, [new Uint8Array(256)], { provider });
    const zero = slotValueToBytes(0n);
    const existing = [1n, 2n, 65n, 66n].map((key) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(key)]),
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'values'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, existing[0].slot)) } } },
        ...existing.map(({ slot }, index) => ({
          address: getEntryNftAddress(pinned, category, 'values'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, existing[index + 1]?.slot ?? zero, bigIntToVmNumber(0n),
            )) } },
        })),
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [2n] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }
    await call.send();
    const values = await contract.getEntries('values');
    const valueAt = (key: bigint): unknown => values.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([1n, 2n, 65n, 66n].map(valueAt)).toEqual([11n, 12n, 21n, 22n]);
  }, 60_000);

  it('fences read/write post-recursion frames with mixed settlement phases', async () => {
    const provider = createTestProvider();
    // Two independently authenticated 64-row resources put this deliberately small fixture just beyond BCH's
    // operation-density ratio. A constructor byte vector increases locking-program density without changing the
    // handler or its resource semantics.
    const artifact = compileString(`contract UnwindReads(bytes densityPadding) {
      mapping(int => int) source;
      mapping(int => int) destination;
      function apply(int cursor, int fallbackValue) public returns (int) {
        if (cursor == 0) return fallbackValue;
        int result = apply(cursor - 1, fallbackValue);
        this.destination[cursor] = this.source[cursor] + result;
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!handler?.eligible) return;
    const inner = new Contract(artifact, [new Uint8Array(256)], { provider });
    const zero = slotValueToBytes(0n);
    const sourceEntries = [[1n, 10n], [2n, 20n], [3n, 30n]] as const;
    const sourceNodes = sourceEntries.map(([key, value]) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'source'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, sourceNodes[0].slot)) } } },
        ...sourceNodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, 'source'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, sourceNodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
        { address: getEntryNftAddress(pinned, category, 'destination'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);

    const call = contract.batch([{ function: 'apply', args: [3n, 5n] }]);
    // Supply fees for the three inserted destination entries.
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const sourceLock = addressToLockScript(getEntryNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'source',
    ));
    const preservedSource = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.lockingBytecode) === binToHex(sourceLock)
      && output.token.nft.commitment.length > 64);
    expect(preservedSource).toBeGreaterThanOrEqual(0);
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== preservedSource ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInputIndex, sourceOutputs, transaction: hostile })))
      .not.toBe(true);

    await call.send();
    const destination = await contract.getEntries('destination');
    const valueAt = (key: bigint): unknown => destination.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([1n, 2n, 3n].map(valueAt)).toEqual([15n, 25n, 35n]);
  }, 60_000);

  it('fences nested read/write streams with mixed settlement phases', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract NestedUnwindRead(bytes densityPadding) {
      mapping(int => mapping(int => int)) source;
      mapping(int => int) destination;
      function apply(int cursor, int fallbackValue) public returns (int) {
        if (cursor == 0) return fallbackValue;
        int result = apply(cursor - 1, fallbackValue);
        this.destination[cursor] = this.source[7][cursor + 1] + this.source[8][cursor + 1] + result;
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!handler?.eligible) return;
    const inner = new Contract(artifact, [new Uint8Array(256)], { provider });
    const zero = slotValueToBytes(0n);
    const sourceEntries = [[7n, 2n, 10n], [8n, 2n, 1n]] as const;
    const sourceNodes = sourceEntries.map(([outerKey, innerKey, value]) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(outerKey), bigIntToVmNumber(innerKey)]), value,
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'source'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, sourceNodes[0].slot)) } } },
        ...sourceNodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, 'source'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, sourceNodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
        { address: getEntryNftAddress(pinned, category, 'destination'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [1n, 5n] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const sourceLock = addressToLockScript(getEntryNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'source',
    ));
    const preservedSource = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.lockingBytecode) === binToHex(sourceLock)
      && output.token.nft.commitment.length > 64);
    expect(preservedSource).toBeGreaterThanOrEqual(0);
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== preservedSource ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInputIndex, sourceOutputs, transaction: hostile })))
      .not.toBe(true);

    await call.send();
    const destination = await contract.getEntries('destination');
    const valueAt = (key: bigint): unknown => destination.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect(valueAt(1n)).toBe(16n);
  }, 60_000);

  it('fences source-ordered reads beside an independently settled write', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract UnwindRequirements(bytes densityPadding) {
      mapping(int => int) observed;
      mapping(int => int) recorded;
      function apply(int cursor, int floor) public returns (int) {
        if (cursor == 0) return floor;
        int result = apply(cursor - 1, floor);
        require(this.observed[cursor] == cursor + floor);
        this.recorded[cursor + 64] = result + cursor;
        return result;
      }
    }`, KERNEL);
    const applyAbi = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    const readInfo = applyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'observed');
    expect(readInfo).toMatchObject({
      op: 'read', oldValuesWitnessParam: expect.any(String),
      settlementIdentity: {
        settlementRole: 'carrier-only', settlementOwnership: 'none',
        recordDispositionSource: 'authenticated-carrier',
      },
    });
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!handler?.eligible) return;
    const inner = new Contract(artifact, [new Uint8Array(2048)], { provider });
    const zero = slotValueToBytes(0n);
    const observedNodes = [1n, 2n, 3n].map((key) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(key)]), value: key + 10n,
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, observedNodes[0].slot)) } } },
        ...observedNodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, observedNodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
        { address: getEntryNftAddress(pinned, category, 'recorded'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [3n, 10n] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === readInfo!.oldValuesWitnessParam);
    expect(witnessRouteIndex).toBeGreaterThanOrEqual(0);
    expect(routeUnlocker.params[witnessRouteIndex]).toEqual([[11n, 12n, 13n]]);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = [[12n, 11n, 13n]];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'reordered read witness').not.toBe(true);
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    await expect(call.send()).resolves.toBeDefined();
    const recorded = await contract.getEntries('recorded');
    const valueAt = (key: bigint): unknown => recorded.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([65n, 66n, 67n].map(valueAt)).toEqual([11n, 12n, 13n]);
  }, 60_000);

  it('settles a bounded requirement-only unwind and rejects a hostile read witness', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract ReadOnlyUnwind(bytes densityPadding) {
      mapping(int => int) observed;
      function apply(int cursor, int step, int floor) public returns (int) {
        if (cursor == 0) return floor;
        int result = apply(cursor - step, step, floor);
        require(this.observed[cursor + 1] == result + cursor + 1);
        return result;
      }
    }`, KERNEL);
    const applyAbi = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    const readInfo = applyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'observed');
    expect(readInfo).toMatchObject({
      op: 'read', oldValuesWitnessParam: expect.any(String),
      settlementIdentity: {
        settlementRole: 'carrier-only', settlementOwnership: 'none',
        recordDispositionSource: 'authenticated-carrier',
      },
    });
    const inner = new Contract(artifact, [new Uint8Array(2048)], { provider });
    const zero = slotValueToBytes(0n);
    const observedNodes = [[3n, 13n], [5n, 15n], [7n, 17n]].map(([key, value]) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, observedNodes[0].slot)) } } },
        ...observedNodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, observedNodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [6n, 2n, 10n] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === readInfo!.oldValuesWitnessParam);
    expect(witnessRouteIndex).toBeGreaterThanOrEqual(0);
    expect(routeUnlocker.params[witnessRouteIndex]).toEqual([[13n, 15n, 17n]]);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const routeSelector = artifact.messageBus!.route.selector;
    if (!routeSelector) throw new Error('message-bus route has no selector');
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(routeSelector),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = [[15n, 13n, 17n]];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'reordered requirement-only witness').not.toBe(true);
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    // Five cannot reach the zero frame by repeated subtraction of two. The route may derive a finite witness,
    // but the compiler-owned exact-step guard must reject it before that approximation can authorize a read.
    const inexact = contract.batch([{ function: 'apply', args: [5n, 2n, 10n] }]);
    const inexactFee = await createBareP2pkhFeeFunder(provider, 500_000n);
    inexact.addInput(inexactFee.utxo, inexactFee.unlocker);
    inexact.addOutput({ to: inexactFee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const inexactBuilder = await inexact.build();
    const inexactRoute = inexactBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(inexactRoute).toBeGreaterThanOrEqual(0);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: inexactRoute,
      sourceOutputs: generateLibauthSourceOutputs(inexactBuilder.inputs),
      transaction: inexactBuilder.buildLibauthTransaction(),
    })), 'inexact recursive step').not.toBe(true);

    expect(() => contract.batch([{ function: 'apply', args: [130n, 2n, 10n] }]))
      .toThrow(/64|maximum|capacity|iteration/i);
    await expect(call.send()).resolves.toBeDefined();
  }, 60_000);

  it('authenticates only the taken path of a nested unwind requirement', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract SelectedUnwindReads(bytes densityPadding) {
      mapping(int => int) observed;
      function apply(int cursor, int floor) public returns (int) {
        if (cursor == 0) return floor;
        int result = apply(cursor - 1, floor);
        if (cursor % 2 == 0) {
          require(this.observed[cursor + 1] == result + cursor + 1);
        }
        return result;
      }
    }`, KERNEL);
    const applyAbi = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    const readInfo = applyAbi.sortedUpsertLoopInfo?.find((info) => info.collection === 'observed');
    expect(readInfo).toMatchObject({
      op: 'read', oldValuesWitnessParam: expect.any(String), iterationCondition: expect.anything(),
    });
    const inner = new Contract(artifact, [new Uint8Array(2048)], { provider });
    const zero = slotValueToBytes(0n);
    // Frames one and three do not take the branch, so their possible keys (two and four) are deliberately absent.
    const observedNodes = [[3n, 13n], [5n, 15n]].map(([key, value]) => ({
      slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, observedNodes[0].slot)) } } },
        ...observedNodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, 'observed'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, observedNodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [4n, 10n] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    call.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const witnessRouteIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === readInfo!.oldValuesWitnessParam);
    expect(routeUnlocker.params[witnessRouteIndex]).toEqual([[13n, 15n]]);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessRouteIndex] = [[15n, 13n]];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'reordered selected witness').not.toBe(true);
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;
    await expect(call.send()).resolves.toBeDefined();
  }, 60_000);

  it('fences multiple selected read streams without shared frame-selection identity', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract SwitchUnwindReads(bytes densityPadding) {
      mapping(int => int) first;
      mapping(int => int) second;
      mapping(int => int) fallbackValues;
      function apply(int cursor, int floor, int firstCase, int secondCase) public returns (int) {
        if (cursor == 0) return floor;
        int result = apply(cursor - 1, floor, firstCase, secondCase);
        switch (cursor % 3) {
          case firstCase: require(this.first[cursor + 1] == result + cursor + 1); break;
          case secondCase: require(this.second[cursor + 65] == result + cursor + 65); break;
          default: require(this.fallbackValues[cursor + 129] == result + cursor + 129); break;
        }
        return result;
      }
    }`, KERNEL);
    const applyAbi = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    const reads = applyAbi.sortedUpsertLoopInfo?.filter((info) => info.op === 'read') ?? [];
    expect(reads.map((info) => info.collection)).toEqual(['first', 'second', 'fallbackValues']);
    expect(reads.every((info) => info.oldValuesWitnessDomain === 'selected-source')).toBe(true);
    expect(reads.every((info) => info.sourceOrderIndexParam?.startsWith(
      '__internal__vmapCounterSourceIndex_',
    ))).toBe(true);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const refused = StatefulContract.withCategory(
      new Contract(artifact, [new Uint8Array(2304)], { provider }), new Uint8Array(32),
    );
    expect(() => refused.batch([{
      function: 'apply', args: [4n, 10n, 1n, 2n],
    }])).toThrow(/KERNEL_LAYOUT/);
    if (!handler?.eligible) return;
    const inner = new Contract(artifact, [new Uint8Array(2304)], { provider });
    const zero = slotValueToBytes(0n);
    const entries = new Map<string, Array<{ slot: Uint8Array; value: bigint }>>([
      ['first', [[2n, 12n], [5n, 15n]].map(([key, value]) => ({
        slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
      }))],
      ['second', [[67n, 77n]].map(([key, value]) => ({
        slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
      }))],
      ['fallbackValues', [[131n, 141n], [132n, 142n]].map(([key, value]) => ({
        slot: keyToSlotMulti([bigIntToVmNumber(key)]), value,
      }))],
    ]);
    for (const nodes of entries.values()) nodes.sort((left, right) =>
      bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      const collectionUtxos = [...entries].flatMap(([collection, nodes]) => [
        { address: getEntryNftAddress(pinned, category, collection), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, nodes[0]?.slot ?? zero)) } } },
        ...nodes.map(({ slot, value }, index) => ({
          address: getEntryNftAddress(pinned, category, collection), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, nodes[index + 1]?.slot ?? zero, bigIntToVmNumber(value),
            )) } },
        })),
      ]);
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        ...collectionUtxos,
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const buildApply = async (firstCase: bigint, secondCase: bigint): Promise<TransactionBuilder> => {
      const pending = contract.batch([{
        function: 'apply', args: [4n, 10n, firstCase, secondCase],
      }]);
      pending.addInput(fee.utxo, fee.unlocker);
      pending.addOutput({ to: fee.unlocker.generateLockingBytecode(), amount: 1_200n });
      return pending.build();
    };
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const distinctBuilder = await buildApply(1n, 2n);
    const distinctTransaction = distinctBuilder.buildLibauthTransaction();
    const distinctSourceOutputs = generateLibauthSourceOutputs(distinctBuilder.inputs);
    for (let inputIndex = 0; inputIndex < distinctTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: distinctSourceOutputs, transaction: distinctTransaction,
      })), `distinct-case honest input ${inputIndex}`).toBe(true);
    }

    // Equal dynamic labels shadow the later case for every public input. Its selected stream must remain a valid,
    // authenticated zero-cardinality participant rather than making an otherwise valid source call fail.
    const builder = await buildApply(1n, 1n);
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const witnessIndices = reads.map((read) => artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === read.oldValuesWitnessParam));
    const sourceIndexIndices = reads.map((read) => artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === read.sourceOrderIndexParam));
    expect(witnessIndices.every((index) => index >= 0)).toBe(true);
    expect(sourceIndexIndices.every((index) => index >= 0)).toBe(true);
    expect(witnessIndices.map((index) => routeUnlocker.params[index])).toEqual([
      [[12n, 15n]], [[]], [[142n, 141n]],
    ]);
    expect(sourceIndexIndices.map((index) => routeUnlocker.params[index])).toEqual([
      [[0n, 1n]], [[]], [[1n, 0n]],
    ]);

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[witnessIndices[0]] = [[15n, 12n]];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'reordered switch witness').not.toBe(true);
    hostileParams[witnessIndices[0]] = routeUnlocker.params[witnessIndices[0]];
    hostileParams[sourceIndexIndices[2]] = [[0n, 0n]];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'forged switch source index').not.toBe(true);
  }, 60_000);

  it('emits selected post-recursion events in unwind order and authenticates the zero-frame case', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract UnwindEvents() {
      event Selected(int value);
      event Visited(int value);
      function apply(int cursor, int offset) public returns (int) {
        if (cursor == 0) return offset + 7;
        int result = apply(cursor - 1, offset);
        if (cursor % 2 == 1) emit Selected(result + cursor);
        emit Visited(cursor + offset);
        return result;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const callerArtifact = compileString(`
      interface IEffectTarget { function apply(int cursor, int offset) returns (int); }
      contract EffectCaller(address target) {
        event Requested(int offset);
        function initiate(int cursor, int offset) public {
          emit Requested(offset);
          int result = IEffectTarget(target).apply(cursor, offset);
          require(result == offset + 7);
        }
      }
    `, KERNEL);
    const callerInner = new Contract(callerArtifact, [contract.inner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerInner, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(callerInner, callerSetup.categoryId);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = messageBus.compose({
      calls: [caller.call.initiate(4n, 10n), contract.call.apply(4n, 10n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name
      && input.token?.category === categoryId);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }
    const selectedLock = addressToLockScript(getEventNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'Selected(int256)',
    ));
    const visitedLock = addressToLockScript(getEventNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'Visited(int256)',
    ));
    const eventOutput = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.lockingBytecode) === binToHex(selectedLock));
    expect(eventOutput).toBeGreaterThanOrEqual(0);
    const callerEventLock = addressToLockScript(getEventNftAddress(
      callerInner.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId, 'Requested(int256)',
    ));
    const eventLocks = new Map([
      [binToHex(callerEventLock), 'Requested'],
      [binToHex(selectedLock), 'Selected'],
      [binToHex(visitedLock), 'Visited'],
    ]);
    expect(transaction.outputs.flatMap((output) => {
      const event = eventLocks.get(binToHex(output.lockingBytecode));
      return event && output.token?.nft
        ? [[event, binToHex(output.token.nft.commitment)]] : [];
    })).toEqual([
      ['Requested', '5a'],
      ['Selected', '0112'], ['Visited', '5b'],
      ['Visited', '5c'],
      ['Selected', '0114'], ['Visited', '5d'],
      ['Visited', '5e'],
    ]);
    const hostile = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== eventOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!, commitment: '00' } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInputIndex, sourceOutputs, transaction: hostile })))
      .not.toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(contract.call.apply(0n, 10n).send()).resolves.toMatchObject({ events: [] });
  }, 60_000);

  it('settles void post-recursion effects from the innermost retained frame outward', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract VoidUnwindStreams() {
      mapping(int => int) selected;
      function apply(int cursor, int threshold) public {
        if (cursor == 0) return;
        apply(cursor - 1, threshold);
        if (cursor > threshold) this.selected[cursor] = cursor + 40;
        require(cursor >= 1);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const zero = slotValueToBytes(0n);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'selected'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [4n, 2n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }
    await call.send();
    const selected = await contract.getEntries('selected');
    const valueAt = (key: bigint): unknown => selected.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([1n, 2n, 3n, 4n].map(valueAt)).toEqual([undefined, undefined, 43n, 44n]);
  }, 60_000);

  it('authenticates false predicates and outputs in post-recursion unwind order', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract UnwindStreams() {
      mapping(int => int) selected;
      function apply(int cursor, int threshold, int stride) public returns (int) {
        if (cursor == 0) return threshold;
        int result = apply(cursor - stride, threshold, stride);
        if (cursor > threshold) this.selected[cursor] = result + cursor;
        return result;
      }
    }`, KERNEL);
    const stream = artifact.abi.find((candidate) => candidate.name === 'apply')!
      .sortedUpsertLoopInfo![0];
    expect(stream).toMatchObject({ collection: 'selected', op: 'set' });
    expect(stream.iterationCondition).toBeDefined();
    const inner = new Contract(artifact, [], { provider });
    const zero = slotValueToBytes(0n);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getEntryNftAddress(pinned, category, 'selected'), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [8n, 4n, 2n] }]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const permutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === stream.varyingArrayParam);
    const permutations = routeUnlocker.params[permutationIndex] as bigint[][];
    expect(permutations).toHaveLength(1);
    expect(permutations[0]).toHaveLength(2); // unwind frames 2 and 4 are false; only 6 and 8 are selected.

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[permutationIndex] = [permutations[0].slice(1)];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'omitted unwind frame').not.toBe(true);
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const selectedLock = addressToLockScript(getEntryNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'selected',
    ));
    const selectedOutput = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.lockingBytecode) === binToHex(selectedLock));
    expect(selectedOutput).toBeGreaterThanOrEqual(0);
    const hostileOutput = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== selectedOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: hostileOutput,
    })), 'altered unwind output').not.toBe(true);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }

    const inexact = contract.batch([{ function: 'apply', args: [7n, 4n, 2n] }]);
    const inexactBuilder = await inexact.build();
    const inexactRouteIndex = inexactBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const inexactTransaction = inexactBuilder.buildLibauthTransaction();
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: inexactRouteIndex,
      sourceOutputs: generateLibauthSourceOutputs(inexactBuilder.inputs),
      transaction: inexactTransaction,
    })), 'non-divisible recursion endpoint').not.toBe(true);
    await call.send();
    const selected = await contract.getEntries('selected');
    const valueAt = (key: bigint): unknown => selected.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([2n, 4n, 6n, 8n].map(valueAt)).toEqual([undefined, undefined, 10n, 12n]);
  }, 60_000);

  it('fences source-ordered mutations without shared settlement geometry', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract RecursiveStreams() {
      mapping(int => int) retained;
      mapping(int => int) cleared;
      function apply(int cursor) public returns (int) {
        this.retained[cursor + 10] = cursor + 20;
        delete this.cleared[cursor];
        if (cursor == 0) return 0;
        return apply(cursor - 1);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!handler?.eligible) return;
    expect(artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo)
      .toEqual([
        expect.objectContaining({ collection: 'retained', op: 'set' }),
        expect.objectContaining({ collection: 'cleared', op: 'delete' }),
      ]);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(2 * 64 + 2);
    expect(artifact.debug!.bytecode.length / 2).toBeLessThanOrEqual(10_000);
    const inner = new Contract(artifact, [], { provider });
    const zero = slotValueToBytes(0n);
    const seeded = [0n, 1n, 2n].map((key) => ({
      key, slot: keyToSlotMulti([bigIntToVmNumber(key)]),
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      const retainedAddress = getEntryNftAddress(pinned, category, 'retained');
      const clearedAddress = getEntryNftAddress(pinned, category, 'cleared');
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: retainedAddress, satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: clearedAddress, satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, seeded[0].slot)) } } },
        ...seeded.map(({ key, slot }, index) => ({
          address: clearedAddress,
          satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, seeded[index + 1]?.slot ?? zero, bigIntToVmNumber(key + 100n),
            )) } },
        })),
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);

    const call = contract.batch([{ function: 'apply', args: [2n] }]);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `input ${inputIndex}`).toBe(true);
    }
    await call.send();

    const [retained, cleared] = await Promise.all([
      contract.getEntries('retained'), contract.getEntries('cleared'),
    ]);
    const valueAt = (entries: typeof retained, key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([valueAt(retained, 10n), valueAt(retained, 11n), valueAt(retained, 12n)])
      .toEqual([20n, 21n, 22n]);
    // Mapping deletion retains authenticated list nodes as typed-default tombstones.
    // Check every seeded slot, rather than conflating a missing lookup with the int default.
    expect(cleared).toHaveLength(3);
    expect([valueAt(cleared, 0n), valueAt(cleared, 1n), valueAt(cleared, 2n)])
      .toEqual([0n, 0n, 0n]);
    expect(cleared.some((entry) => [100n, 101n, 102n].includes(entry.value as bigint))).toBe(false);
  }, 60_000);

  it('fences conditional multi-mutation frames without shared settlement geometry', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract ConditionalStreams() {
      mapping(int => int) selected;
      mapping(int => int) cleared;
      function apply(int cursor, int threshold) public returns (int) {
        if (cursor % 2 == 0) this.selected[cursor] = cursor + 50;
        if (cursor > threshold) delete this.cleared[cursor];
        if (cursor == 0) return threshold;
        return apply(cursor - 1, threshold);
      }
    }`, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    const streams = handler.sortedUpsertLoopInfo!;
    expect(streams.map((stream) => [stream.collection, stream.op])).toEqual([
      ['selected', 'set'], ['cleared', 'delete'],
    ]);
    expect(streams.every((stream) => stream.iterationCondition !== undefined)).toBe(true);
    const routeHandler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(routeHandler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    if (!routeHandler?.eligible) return;
    const inner = new Contract(artifact, [], { provider });
    const zero = slotValueToBytes(0n);
    const seeded = [0n, 1n, 2n, 3n, 4n].map((key) => ({
      key, slot: keyToSlotMulti([bigIntToVmNumber(key)]),
    })).sort((left, right) => bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1);
    const { categoryId } = await provider.addTokenUtxosDynamic((category) => {
      const pinned = inner.withCategory(hexToBin(category));
      const selectedAddress = getEntryNftAddress(pinned, category, 'selected');
      const clearedAddress = getEntryNftAddress(pinned, category, 'cleared');
      return [
        { address: pinned.tokenAddress, satoshis: 10_000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: selectedAddress, satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, zero)) } } },
        { address: clearedAddress, satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(zero, seeded[0].slot)) } } },
        ...seeded.map(({ key, slot }, index) => ({
          address: clearedAddress,
          satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(encodeEntryCommitment(
              slot, seeded[index + 1]?.slot ?? zero, bigIntToVmNumber(key + 100n),
            )) } },
        })),
        { address: getMessageBusVerifierAddress(pinned, category), satoshis: 1_200n,
          token: { amount: 0n, nft: { capability: 'mutable' as const,
            commitment: binToHex(messageBusVerifierCommitment(0)) } } },
      ];
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([{ function: 'apply', args: [4n, 2n] }]);
    const builder = await call.build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const selectedPermutationName = streams.find((stream) => stream.collection === 'selected')!.varyingArrayParam!;
    const selectedPermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === selectedPermutationName);
    const rowPermutations = routeUnlocker.params[selectedPermutationIndex] as bigint[][];
    expect(rowPermutations).toHaveLength(1);
    expect(rowPermutations[0]).toHaveLength(3); // cursor 4, 2, 0; frames 3 and 1 are explicitly absent.
    // Both key permutations differ from their selected source-frame order. This pins the distinction between a
    // key's original logical rank and the source occurrence which consumes its compact journal access.
    expect(rowPermutations[0]).not.toEqual([0n, 2n, 4n]);
    const clearedPermutationName = streams.find((stream) => stream.collection === 'cleared')!.varyingArrayParam!;
    const clearedPermutationIndex = artifact.messageBus!.route.inputs.findIndex((input) =>
      input.name === clearedPermutationName);
    expect(routeUnlocker.params[clearedPermutationIndex]).toEqual([[1n, 0n]]);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    {
      const initialTransaction = builder.buildLibauthTransaction();
      const initialSources = generateLibauthSourceOutputs(builder.inputs);
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex: routeInputIndex, sourceOutputs: initialSources, transaction: initialTransaction,
      })), 'initial honest route').toBe(true);
    }
    const recreateRouteUnlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
    );
    const hostileParams = [...routeUnlocker.params];
    hostileParams[selectedPermutationIndex] = [rowPermutations[0].slice(1)];
    builder.inputs[routeInputIndex].unlocker = recreateRouteUnlocker(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    })), 'omitted selected frame').not.toBe(true);
    builder.inputs[routeInputIndex].unlocker = routeUnlocker;

    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const selectedLock = addressToLockScript(getEntryNftAddress(
      inner.withCategory(hexToBin(categoryId)), categoryId, 'selected',
    ));
    const selectedOutput = transaction.outputs.findIndex((output) => output.token?.nft
      && binToHex(output.lockingBytecode) === binToHex(selectedLock));
    expect(selectedOutput).toBeGreaterThanOrEqual(0);
    const hostileOutput = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== selectedOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: hostileOutput,
    })), 'altered selected output').not.toBe(true);

    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
        `honest input ${inputIndex}`).toBe(true);
    }
    await call.send();
    const [selected, cleared] = await Promise.all([
      contract.getEntries('selected'), contract.getEntries('cleared'),
    ]);
    const valueAt = (entries: typeof selected, key: bigint): unknown => entries.find((entry) =>
      binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
    expect([0n, 1n, 2n, 3n, 4n].map((key) => valueAt(selected, key)))
      .toEqual([50n, undefined, 52n, undefined, 54n]);
    expect([0n, 1n, 2n, 3n, 4n].map((key) => valueAt(cleared, key)))
      .toEqual([100n, 101n, 102n, 0n, 0n]);
  }, 60_000);
});
