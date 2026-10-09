import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { EventDefinitionAbi } from '@solidcash/utils';
import { parseEventCommitment, tryParseEventCommitment } from '../../src/stateful/StateReader.js';

// The evmCompat event-argument frame: a one-byte payload length followed by the value in standard EVM notation
// (big-endian two's-complement at the type's natural width). The platform frame reads the same bytes as a
// little-endian sign-magnitude script push, which is what the contrast cases pin.
const withLength = (payload: Uint8Array): Uint8Array => Uint8Array.from([payload.length, ...payload]);
const word = (hex: string): Uint8Array => hexToBin(hex.padStart(64, '0'));
const event = (parameters: EventDefinitionAbi['parameters']): EventDefinitionAbi =>
  ({ name: 'E', signature: 'E()', parameters });

describe('evmCompat event-argument notation', () => {
  it('reads a marked scalar as big-endian two\'s-complement at its natural width', () => {
    const commitment = binToHex(Uint8Array.from([
      ...withLength(word('0102')),
      ...withLength(Uint8Array.from([1])),
      ...withLength(hexToBin('11'.repeat(20))),
    ]));
    const decoded = parseEventCommitment(commitment, event([
      { name: 'x', type: 'uint256', notation: 'evm' },
      { name: 'b', type: 'bool', notation: 'evm' },
      { name: 'a', type: 'address', notation: 'evm' },
    ]), undefined);
    expect(decoded).toEqual({ x: 0x0102n, b: true, a: hexToBin('11'.repeat(20)) });
  });

  it('sign-extends a negative value from its first byte', () => {
    const commitment = binToHex(withLength(new Uint8Array(32).fill(0xff)));
    expect(parseEventCommitment(commitment, event([
      { name: 'x', type: 'int256', notation: 'evm' },
    ]), undefined)).toEqual({ x: -1n });
  });

  it('reads an unmarked parameter on the platform frame, and rejects a trailing byte', () => {
    const bytes = withLength(word('0102'));
    const marked = parseEventCommitment(binToHex(bytes), event([{ name: 'x', type: 'uint256', notation: 'evm' }]), undefined);
    const platform = parseEventCommitment(binToHex(bytes), event([{ name: 'x', type: 'uint256' }]), undefined);
    expect(marked).toEqual({ x: 0x0102n });
    // The same bytes are a little-endian sign-magnitude script push on the platform frame, so the two readings differ.
    expect(platform.x).not.toEqual(marked.x);
    const trailing = binToHex(Uint8Array.from([...bytes, 0x00]));
    expect(tryParseEventCommitment(trailing, event([{ name: 'x', type: 'uint256', notation: 'evm' }]), undefined))
      .toBeNull();
  });
});
