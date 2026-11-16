/**
 * An event record built from a call's arguments takes each argument as the call passes it to the body. The call
 * passes an `address` given as all-zero bytes as address(0), the empty value, which is what the body then emits, while
 * an event record keeps an address given as bytes as it is.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeEventParameter } from '@solidcash/utils';
import { encodeFunctionArgument, eventValueOfArgument } from '../../src/Argument.js';

const P2PKH = hexToBin('76a91471782e8159265ed94bd35b8e699c08f53a6f38c688ac');

describe('eventValueOfArgument', () => {
  it('passes an all-zero address argument as address(0), as the call encodes it', () => {
    for (const zeros of [new Uint8Array(20), new Uint8Array(32)]) {
      const passed = eventValueOfArgument(zeros, 'address');
      expect(passed).toEqual(new Uint8Array(0));
      expect(passed).toEqual(encodeFunctionArgument(zeros, 'address'));
      expect(binToHex(encodeEventParameter(passed as Uint8Array, { type: 'address' }))).toBe('00');
    }
    expect(eventValueOfArgument(new Uint8Array(20), 'address payable')).toEqual(new Uint8Array(0));
  });

  it('leaves every other argument as it is', () => {
    expect(eventValueOfArgument(P2PKH, 'address')).toBe(P2PKH);
    const zeroHash = new Uint8Array(20);
    expect(eventValueOfArgument(zeroHash, 'bytes20')).toBe(zeroHash);
    expect(eventValueOfArgument(new Uint8Array(0), 'address')).toEqual(new Uint8Array(0));
    expect(eventValueOfArgument('0x0000000000000000000000000000000000000000', 'address'))
      .toBe('0x0000000000000000000000000000000000000000');
    expect(eventValueOfArgument(0n, 'uint256')).toBe(0n);
  });
});
