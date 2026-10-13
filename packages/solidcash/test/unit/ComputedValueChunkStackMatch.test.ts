import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { computeCollectionHash } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { matchComputedValueChunkStack } from '../../src/message-bus/computed-value-chunks.js';
import { persistValueChunkLock, type ValueChunkWriteDescriptor } from '../../src/stateful/StatefulTransactionBuilder.js';

const signature = 'records:mapping(uint256 => Record)';
const write: ValueChunkWriteDescriptor = {
  categoryId: '11'.repeat(32),
  collection: 'records',
  collectionSignature: signature,
  collectionHash: binToHex(computeCollectionHash(signature)),
  keySlot: '22'.repeat(32),
  entryAccessSlot: 0,
  routeSlot: 0,
  operation: 'insert',
  outputBase: -1,
  outputCount: 0,
};
const value = new Uint8Array(197).fill(0x31);
const masterLock = Uint8Array.from({ length: 35 }, (_, index) => (
  index === 0 ? 0xaa : index === 1 ? 0x20 : index === 34 ? 0x87 : 0x42
));
const lock = persistValueChunkLock(write.categoryId, value, write, masterLock)!;

describe('computed mapping-value frame matching', () => {
  it('finds one exact resource value through its VM-computed lock and count', () => {
    const stack = [value, lock, bigIntToVmNumber(2n), new Uint8Array()];
    const matches = matchComputedValueChunkStack(stack, [write], masterLock);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ write, chunkCount: 2 });
    expect(matches[0].value).toEqual(value);
  });

  it('ignores stale values below the compiler-defined count frame', () => {
    const stale = new Uint8Array(206).fill(0x41);
    const stack = [stale, persistValueChunkLock(write.categoryId, stale, write, masterLock)!,
      value, lock, bigIntToVmNumber(2n), new Uint8Array()];
    const matches = matchComputedValueChunkStack(stack, [write], masterLock);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.value).toEqual(value);
  });

  it('rejects a different storage slot or chunk count', () => {
    const other = { ...write, keySlot: '33'.repeat(32) };
    expect(matchComputedValueChunkStack([value, lock, bigIntToVmNumber(2n), new Uint8Array()], [other], masterLock))
      .toEqual([]);
    expect(matchComputedValueChunkStack([value, lock, bigIntToVmNumber(3n), new Uint8Array()], [write], masterLock))
      .toEqual([]);
  });
});
