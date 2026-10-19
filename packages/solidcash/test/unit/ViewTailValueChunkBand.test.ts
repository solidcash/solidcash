import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type { UnlockableUtxo } from '../../src/interfaces.js';
import {
  vacateViewTailsFromJobEventsBand,
  vacateViewTailsFromValueChunkBand,
  type ViewTailOccupancyHost,
} from '../../src/stateful/stb-view-tail-occupancy.js';

describe('view-tail value-chunk band', () => {
  it('retains the historical JobEvents export as an exact alias', () => {
    expect(vacateViewTailsFromJobEventsBand).toBe(vacateViewTailsFromValueChunkBand);
  });

  it('vacates a generic writer band while preserving predecessor outputs', () => {
    const predecessorLock = Uint8Array.of(0xaa, 0x20, 0x01);
    const paddingLock = Uint8Array.of(0xaa, 0x20, 0x02);
    const predecessorToken = {
      category: 'ab'.repeat(31) + '54', amount: 0n,
      nft: { capability: 'mutable' as const, commitment: '0000abcd' },
    };
    const inputs = [predecessorLock, predecessorLock, paddingLock].map((lock, index) => ({
      txid: '11'.repeat(32), vout: index, satoshis: 5000n,
      unlocker: { generateLockingBytecode: () => lock },
      ...(index === 1 ? { token: predecessorToken } : {}),
    })) as UnlockableUtxo[];
    const outputs = inputs.map(() => ({
      to: Uint8Array.of(0x51), amount: 800n,
      token: {
        category: 'cd'.repeat(31) + '32', amount: 0n,
        nft: { capability: 'none' as const, commitment: '01' },
      },
    }));
    const builder = { outputs } as unknown as TransactionBuilder;
    let derivedReapplications = 0;
    const host = {
      allInputs: inputs,
      getChunkableValueWriteBand: () => ({ start: 1, end: 2, nNew: 2 }),
      applyDerivedValueChunks: () => { derivedReapplications += 1; },
    } as unknown as ViewTailOccupancyHost;

    vacateViewTailsFromValueChunkBand(host, builder);

    expect(builder.outputs[1]).toEqual({
      to: predecessorLock, amount: 5000n, token: predecessorToken,
    });
    expect(builder.outputs[2]).toEqual({ to: paddingLock, amount: 5000n });
    expect(derivedReapplications).toBe(1);
  });
});
