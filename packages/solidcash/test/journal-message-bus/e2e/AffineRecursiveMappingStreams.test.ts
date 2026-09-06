import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { messageBusVerifierCommitment } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  bytesToSlotValue, Contract, encodeEntryCommitment, slotValueToBytes, StatefulContract,
} from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  getEntryNftAddress, getMessageBusVerifierAddress,
} from '../../../src/stateful/covenant-helpers.js';
import { createTestProvider } from '../../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('affine recursive mapping streams', () => {
  it('settles source-ordered set and affine-key delete streams across two collections', async () => {
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
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
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

  it('authenticates conditional frame selection and rejects omitted witnesses or altered outputs', async () => {
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
