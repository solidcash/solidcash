import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { messageBusVerifierCommitment } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  bytesToSlotValue, Contract, encodeEntryCommitment, slotValueToBytes, StatefulContract,
} from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
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
});
