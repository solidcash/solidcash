import { binToHex, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  libauthOutputToSolidCashOutput, solidCashOutputToLibauthOutput,
} from '../../src/utils.js';

/**
 * A transaction rebuilt from a derived one (a framed broadcast) states its outputs exactly as the derivation did. The
 * token category is part of that transaction, and its byte order must survive the trip through the SDK's `Output`.
 */
describe('a libauth output converted to the SDK shape and back', () => {
  it('returns the derived output unchanged, with a non-palindromic category', () => {
    const category = hexToBin('43d4e11d0a6929eccf5b6a0b645032f22a24ee75f46760bbd410cbe2220bb73e');
    const output = {
      lockingBytecode: Uint8Array.of(0x51),
      valueSatoshis: 1_200n,
      token: { category, amount: 0n, nft: { capability: 'mutable' as const, commitment: Uint8Array.of(0xab) } },
    };
    const back = solidCashOutputToLibauthOutput(libauthOutputToSolidCashOutput(output));
    expect(back).toBe(output);
    expect(binToHex(back.token!.category)).toBe(binToHex(category));
    expect(binToHex(back.token!.nft!.commitment)).toBe('ab');
  });
});
