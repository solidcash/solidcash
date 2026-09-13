import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodeInt, scriptToBytecode } from '@solidcash/utils';
import {
  nestedProxyImplementationInputIndex, selectProxyForwardInput,
} from '../../src/stateful/StatefulContract.js';

describe('selectProxyForwardInput', () => {
  it('prefers the logical 4-byte implementation selector over a compiler-route SCB1 argument', () => {
    const scb1 = hexToBin('53434231');
    const selected = selectProxyForwardInput('a826ee9c', [scb1]);
    expect(binToHex(selected)).toBe('a826ee9c');
    expect(selected).toHaveLength(4);
  });

  it('prefers a retargeted writer selector over a stale shared-view logical name', () => {
    const selected = selectProxyForwardInput('2d232774', [hexToBin('a826ee9c')]);
    expect(binToHex(selected)).toBe('a826ee9c');
  });

  it('falls back to a 4-byte functionArgs selector when no logical hex is provided', () => {
    const selected = selectProxyForwardInput(undefined, [hexToBin('a826ee9c')]);
    expect(binToHex(selected)).toBe('a826ee9c');
  });

  it('places that selector as the first 4-byte unlocking push after a short delegate index', () => {
    const selector = selectProxyForwardInput('a826ee9c');
    const unlocking = scriptToBytecode([...[selector, encodeInt(10n)]].reverse());
    // OP_10 (folded 1-byte 0x0a) then push4(selector). emitExtractUnlockingSelector skips the
    // short OP_N prefix and EQUALVERIFYs the 4-byte payload against the caller pin.
    expect(unlocking[0]).toBe(0x5a);
    expect(unlocking[1]).toBe(4);
    expect(binToHex(unlocking.slice(2, 6))).toBe('a826ee9c');
  });
});

describe('nestedProxyImplementationInputIndex', () => {
  it('sits immediately after the proxy master and its data NFTs', () => {
    expect(nestedProxyImplementationInputIndex(6, 2)).toBe(9);
    expect(nestedProxyImplementationInputIndex(0, 1)).toBe(2);
  });
});
