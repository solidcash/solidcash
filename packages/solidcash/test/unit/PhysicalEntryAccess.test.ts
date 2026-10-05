import { describe, expect, it } from 'vitest';
import type { AbiFunction, EntryAccessAbi } from '@solidcash/utils';
import { buildEntryNftCovenantScript, computeCollectionHash } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import {
  cachedEntryOutputOwnsLock, physicalEntryAccessForSlot,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import { externalEntryLockingBytecode } from '../../src/stateful/stb-minting-swap-predecessors.js';
import { scriptToLockingBytecode } from '../../src/utils.js';

const access = (collection: string): EntryAccessAbi => ({
  collection,
  keyParams: ['key'],
  operations: ['read'],
});

describe('physical compiler-route entry ownership', () => {
  it('uses the route slot instead of a logical handler local ordinal', () => {
    const routeEntries = Array<EntryAccessAbi | undefined>(19);
    routeEntries[18] = access('journal');
    const route = { entryAccesses: routeEntries } as unknown as Pick<AbiFunction, 'entryAccesses'>;
    const logicalHandler = {
      entryAccesses: [access('labels')],
    } as Pick<AbiFunction, 'entryAccesses'>;

    expect(physicalEntryAccessForSlot(route, [logicalHandler], 18)?.collection).toBe('journal');
    expect(physicalEntryAccessForSlot(undefined, [logicalHandler], 0)?.collection).toBe('labels');
  });

  it('treats a route collection as authoritative when both layouts define the ordinal', () => {
    const route = { entryAccesses: [access('physical')] } as Pick<AbiFunction, 'entryAccesses'>;
    const logical = { entryAccesses: [access('logical')] } as Pick<AbiFunction, 'entryAccesses'>;

    expect(physicalEntryAccessForSlot(route, [logical], 0)?.collection).toBe('physical');
  });

  it('constructs the physical route collection lock even when the selected handler uses that ordinal locally', () => {
    const categoryId = '11'.repeat(32);
    const physicalSignature = 'physical:mapping(bigint => bigint)';
    const logicalSignature = 'logical:mapping(bigint => bigint)';
    const group = {
      categoryId,
      stateLayout: { collections: [
        { name: 'physical', signature: physicalSignature },
        { name: 'logical', signature: logicalSignature },
      ] },
      compilerRoute: { abiFunction: { name: '__message_bus1', entryAccesses: [access('physical')] } },
      logicalFunctionName: 'write',
      logicalArtifact: { abi: [{ name: 'write', entryAccesses: [access('logical')] }] },
    } as never;
    const lock = externalEntryLockingBytecode(group, { kind: 'entry', offset: 1, slotIndex: 0 } as never);
    const expected = scriptToLockingBytecode(
      buildEntryNftCovenantScript(new Uint8Array(32).fill(0x11), computeCollectionHash(physicalSignature)),
      'p2sh32',
    );
    expect(lock).toEqual(expected);
    expect(externalEntryLockingBytecode({
      ...group,
      compilerRoute: { abiFunction: { name: '__message_bus1', entryAccesses: [] } },
      stateLayout: { collections: [{ name: 'physical', signature: physicalSignature }] },
    } as never, { kind: 'entry', offset: 1, slotIndex: 0 } as never)).toBeUndefined();
  });

  it('does not replay a learned entry transition onto a new collection at the same coordinate', () => {
    const firstCollectionLock = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
    const secondCollectionLock = firstCollectionLock.slice();
    secondCollectionLock[2] = 1;

    expect(cachedEntryOutputOwnsLock(
      binToHex(firstCollectionLock), firstCollectionLock,
    )).toBe(true);
    expect(cachedEntryOutputOwnsLock(
      binToHex(firstCollectionLock), secondCollectionLock,
    )).toBe(false);
  });
});
