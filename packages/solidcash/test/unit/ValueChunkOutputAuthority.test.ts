import { describe, expect, it } from 'vitest';
import {
  isAllZeroCommitment,
  reassertNoneCapFunderTwins as reassertValueChunkFunderTwins,
} from '../../src/stateful/StatefulTransactionBuilder.js';

describe('value-chunk output authority', () => {
  it('treats all-zero hex and bytes as empty probe seeds', () => {
    expect(isAllZeroCommitment('00'.repeat(32))).toBe(true);
    expect(isAllZeroCommitment(new Uint8Array(32))).toBe(true);
    expect(isAllZeroCommitment('00'.repeat(31) + '01')).toBe(false);
  });

  it('restores insert-band dust onto a bare OP_TRUE slot', () => {
    const inputs = [{
      txid: 'aa'.repeat(32),
      vout: 0,
      satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => new Uint8Array([0x76, 0xa9]) },
      token: {
        amount: 0n,
        category: '01' + '0'.repeat(62),
        nft: { capability: 'none' as const, commitment: '0'.repeat(64) },
      },
    }] as any;
    const outputs = [{ to: Uint8Array.of(0x51), amount: 1000n }];
    expect(reassertValueChunkFunderTwins(outputs as any, inputs)).toBe(1);
    expect(outputs[0]?.token?.nft?.capability).toBe('none');
    expect(String(outputs[0]?.token?.nft?.commitment)).toBe('0'.repeat(64));
    expect(outputs[0]?.to).toEqual(Uint8Array.of(0x51));
  });

  it('does not clobber a mutable occupant', () => {
    const inputs = [{
      txid: 'bb'.repeat(32),
      vout: 1,
      satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => new Uint8Array([0x76, 0xa9]) },
      token: {
        amount: 0n,
        category: '01' + '0'.repeat(62),
        nft: { capability: 'none' as const, commitment: '0'.repeat(64) },
      },
    }] as any;
    const outputs = [{
      to: new Uint8Array(35),
      amount: 1200n,
      token: {
        amount: 0n,
        category: 'cc'.repeat(32),
        nft: { capability: 'mutable' as const, commitment: '00' },
      },
    }];
    expect(reassertValueChunkFunderTwins(outputs as any, inputs)).toBe(0);
    expect(outputs[0]?.token?.nft?.capability).toBe('mutable');
  });

  it('restores own-category insert-band dust', () => {
    const category = 'ab'.repeat(32);
    const inputs = [{
      txid: 'dd'.repeat(32),
      vout: 3,
      satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => new Uint8Array([0x76, 0xa9]) },
      token: {
        amount: 0n,
        category,
        nft: { capability: 'none' as const, commitment: '0'.repeat(64) },
      },
    }] as any;
    const outputs = [{ to: Uint8Array.of(0x51), amount: 1000n }];
    expect(reassertValueChunkFunderTwins(outputs as any, inputs)).toBe(1);
    expect(outputs[0]?.token?.category).toBe(category);
  });

  it('ignores non-dust none-cap inputs', () => {
    const inputs = [{
      txid: 'cc'.repeat(32),
      vout: 2,
      satoshis: 800n,
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51) },
      token: {
        amount: 0n,
        category: 'dd'.repeat(32),
        nft: { capability: 'none' as const, commitment: '01'.repeat(32) },
      },
    }] as any;
    const outputs = [{ to: Uint8Array.of(0x51), amount: 800n }];
    expect(reassertValueChunkFunderTwins(outputs as any, inputs)).toBe(0);
    expect(outputs[0]?.token).toBeUndefined();
  });
});
