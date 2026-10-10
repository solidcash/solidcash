import { describe, it, expect } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import type { EventDefinitionAbi } from '@solidcash/utils';
import { parseEventCommitment, tryParseEventCommitment } from '../../src/stateful/StateReader.js';

// The evmCompat event-argument notation: the bytes `abi.encodePacked` produces at the type's natural width, with
// no length byte (the reader takes the width from the type). The platform frame reads the same bytes as a
// little-endian sign-magnitude script push, which is what the contrast case pins.
const word = (hex: string): Uint8Array => hexToBin(hex.padStart(64, '0'));
const event = (parameters: EventDefinitionAbi['parameters']): EventDefinitionAbi =>
  ({ name: 'E', signature: 'E()', parameters });

describe('evmCompat event-argument notation', () => {
  it('reads a marked scalar as big-endian two\'s-complement at its natural width', () => {
    const commitment = binToHex(Uint8Array.from([
      ...word('0102'),
      ...[1],
      ...hexToBin('11'.repeat(32)),
    ]));
    const decoded = parseEventCommitment(commitment, event([
      { name: 'x', type: 'uint256', notation: 'evm' },
      { name: 'b', type: 'bool', notation: 'evm' },
      { name: 'h', type: 'bytes32', notation: 'evm' },
    ]), undefined);
    expect(decoded).toEqual({ x: 0x0102n, b: true, h: hexToBin('11'.repeat(32)) });
  });

  it('sign-extends a negative value from its first byte', () => {
    const commitment = binToHex(new Uint8Array(32).fill(0xff));
    expect(parseEventCommitment(commitment, event([
      { name: 'x', type: 'int256', notation: 'evm' },
    ]), undefined)).toEqual({ x: -1n });
  });

  it('keeps an unsigned width unsigned above its high bit', () => {
    const commitment = binToHex(Uint8Array.from([0xc8, 0xff, 0xff]));
    expect(parseEventCommitment(commitment, event([
      { name: 'x', type: 'uint8', notation: 'evm' },
      { name: 'y', type: 'int16', notation: 'evm' },
    ]), undefined)).toEqual({ x: 200n, y: -1n });
  });

  it('reads an unmarked parameter on the platform frame, and rejects trailing data after a marked one', () => {
    // A platform-framed uint256 is a pushdata of the little-endian sign-magnitude number: 0x1f pushes the 31
    // bytes that follow, so this 32-byte buffer is one whole platform argument.
    const bytes = Uint8Array.from([0x1f, ...new Uint8Array(31).fill(0x01)]);
    const platform = parseEventCommitment(binToHex(bytes), event([{ name: 'x', type: 'uint256' }]), undefined);
    // The same buffer is one marked parameter's 32 packed bytes, and the two readings differ: the platform
    // frame reads a little-endian number, the notation a big-endian one.
    const marked = parseEventCommitment(
      binToHex(bytes), event([{ name: 'x', type: 'uint256', notation: 'evm' }]), undefined,
    );
    expect(marked.x).not.toEqual(platform.x);
    const trailing = binToHex(Uint8Array.from([...bytes, 0x00]));
    expect(tryParseEventCommitment(trailing, event([{ name: 'x', type: 'uint256', notation: 'evm' }]), undefined))
      .toBeNull();
  });
});
