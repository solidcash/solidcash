import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { addressToGraphEmissionBytes, encodePushdataValue } from '@solidcash/utils';
import {
  encodeMessageBusArguments, projectGraphEmissionAddressArgs,
} from '../../src/message-bus/message-bus.js';

describe('projectGraphEmissionAddressArgs', () => {
  it('leaves int-only args unchanged', () => {
    const raw = encodePushdataValue(7n, 'int256');
    const framed = encodeMessageBusArguments([raw], ['int256']);
    const projected = projectGraphEmissionAddressArgs(framed, ['int256']);
    expect(binToHex(projected)).toBe(binToHex(framed));
  });

  it('projects address args to ABI words without touching sibling ints', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    for (let i = 0; i < 32; i += 1) lock[2 + i] = i + 1;
    const addr = encodePushdataValue(lock, 'address');
    const num = encodePushdataValue(7n, 'int256');
    const framed = encodeMessageBusArguments([addr, num], ['address', 'int256']);
    const projected = projectGraphEmissionAddressArgs(framed, ['address', 'int256']);
    expect(projected.length).not.toBe(framed.length);
    const word = addressToGraphEmissionBytes(lock);
    expect(binToHex(projected).includes(binToHex(word))).toBe(true);
  });
});
