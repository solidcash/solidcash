import { describe, expect, it } from 'vitest';
import type { Output, UnlockableUtxo } from '../../src/interfaces.js';
import { reassertReadOnlyMutableOneToOnes } from '../../src/stateful/mutable-output-reassert.js';

describe('ordered read-only mutable output restoration', () => {
  it.each([false, true])('preserves event order and distinct twins (identical %s)', (identical) => {
    const lock = Uint8Array.of(0x51, 0x52);
    const inputs: UnlockableUtxo[] = [0, 1].map((index) => ({
      txid: String(index + 1).repeat(64), vout: 0, satoshis: 1200n,
      token: {
        category: '11'.repeat(31) + 'ee', amount: 0n,
        nft: { capability: 'mutable', commitment: identical ? '0000aa' : `0000a${index}` },
      },
      unlocker: {
        generateLockingBytecode: () => lock,
        generateUnlockingBytecode: () => new Uint8Array(),
      },
    }));
    const twins: Output[] = inputs.map((input) => ({
      to: lock, amount: input.satoshis, token: structuredClone(input.token),
    }));
    const events: Output[] = [0, 1].map((index) => ({
      to: Uint8Array.of(0x53), amount: 1200n,
      token: { category: '11'.repeat(31) + 'ee', amount: 0n, nft: { capability: 'none', commitment: `0${index}` } },
    }));
    const outputs = [events[0], events[1], twins[0], twins[1]];
    expect(reassertReadOnlyMutableOneToOnes(outputs, inputs, inputs, true)).toBe(2);
    expect(outputs).toEqual([...twins, ...events]);
    expect(outputs[0]).toBe(twins[0]);
    expect(outputs[1]).toBe(twins[1]);
    expect(reassertReadOnlyMutableOneToOnes(outputs, inputs, inputs, true)).toBe(0);
  });
});
