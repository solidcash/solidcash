import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCovenantScript, computeCollectionHash, sha256, valueChunkSignature,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { publishedTransportedValueChunkLock } from '../../src/message-bus/compose-assemble.js';
import { scriptToLockingBytecode } from '../../src/utils.js';

const categoryId = '11'.repeat(31) + 'ee';
const masterLock = Uint8Array.from({ length: 35 }, (_, index) => (
  index === 0 ? 0xaa : index === 1 ? 0x20 : index === 34 ? 0x87 : 0x42
));
const value = new Uint8Array(96).fill(0x44);
const collectionSignature = 'records:mapping(uint256 => bytes)';
const write = {
  categoryId,
  collection: 'records',
  collectionSignature,
  collectionHash: binToHex(computeCollectionHash(collectionSignature)),
  keySlot: '22'.repeat(32),
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'update' as const,
  outputBase: 4,
  outputCount: 1,
};

describe('published transported value-chunk lock', () => {
  it('binds the execution lock assembleAtomicComposition passes', () => {
    const published = publishedTransportedValueChunkLock(
      { stateOwner: { categoryId }, value, write }, binToHex(masterLock),
    );
    const expected = scriptToLockingBytecode(buildValueChunkCovenantScript(
      hexToBin(categoryId),
      computeCollectionHash(valueChunkSignature('records')),
      hexToBin(write.keySlot),
      sha256(value),
      masterLock,
    ), 'p2sh32');
    const unbound = scriptToLockingBytecode(buildValueChunkCovenantScript(
      hexToBin(categoryId),
      computeCollectionHash(valueChunkSignature('records')),
      hexToBin(write.keySlot),
      sha256(value),
    ), 'p2sh32');
    expect(binToHex(expected)).not.toBe(binToHex(unbound));
    expect(published).toEqual(expected);
    expect(publishedTransportedValueChunkLock(
      { stateOwner: { categoryId }, value, write }, 'aa',
    )).toBeUndefined();
  });
});
