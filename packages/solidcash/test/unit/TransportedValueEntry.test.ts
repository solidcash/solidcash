import { binToHex } from '@bitauth/libauth';
import { encodeChunkableValueTail } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { materializeTransportedValueEntryCommitment } from '../../src/message-bus/transported-value-entry.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';

const slot = Uint8Array.from({ length: 32 }, (_value, index) => index + 1);
const nextKey = Uint8Array.from({ length: 32 }, (_value, index) => 255 - index);
const oldValue = Uint8Array.from({ length: 80 }, (_value, index) => index);
const newValue = Uint8Array.from({ length: 180 }, (_value, index) => (index * 3) & 0xff);
const currentCommitmentHex = binToHex(encodeEntryCommitment(
  slot, nextKey, encodeChunkableValueTail(oldValue),
));

describe('transported chunkable-value entry recipe', () => {
  it('rebuilds length and root while preserving list linkage', () => {
    expect(materializeTransportedValueEntryCommitment({
      currentCommitmentHex,
      keySlotHex: binToHex(slot),
      value: newValue,
    })).toBe(binToHex(encodeEntryCommitment(
      slot, nextKey, encodeChunkableValueTail(newValue),
    )));
  });

  it('does not claim a different entry or an inline value', () => {
    expect(materializeTransportedValueEntryCommitment({
      currentCommitmentHex,
      keySlotHex: 'ff'.repeat(32),
      value: newValue,
    })).toBeUndefined();
    expect(materializeTransportedValueEntryCommitment({
      currentCommitmentHex,
      keySlotHex: binToHex(slot),
      value: new Uint8Array(28),
    })).toBeUndefined();
  });
});
