import { type Transaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  dynamicChunkPlaceholdersRemain,
  dynamicChunkConvergenceStateKey,
  type ComputedDynamicChunkConvergence,
} from '../../src/message-bus/computed-dynamic-chunks.js';

const incomplete = [{ participant: 0, variable: 'items', resolved: 0, total: 1 }];
const builder = {
  outputs: [
    { token: { nft: { commitment: '000161' } } },
    { token: { nft: { commitment: '00' } } },
  ],
} as unknown as TransactionBuilder;
const convergence = (authenticatedOutputs: number[]): ComputedDynamicChunkConvergence => ({
  repairs: 0,
  rounds: 1,
  ownedOutputs: [0, 1],
  outputs: [],
  authenticatedOutputs,
});

describe('dynamic chunk placeholder admission', () => {
  it('retries a pending chunk after a prerequisite output changes', () => {
    const transaction = (prerequisite: number): Transaction => ({
      version: 2,
      locktime: 0,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: Uint8Array.of(0x51),
      }],
      outputs: [prerequisite, 0].map((commitment) => ({
        lockingBytecode: Uint8Array.of(0x51),
        valueSatoshis: 1_000n,
        token: {
          category: new Uint8Array(32).fill(2),
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment: Uint8Array.of(commitment) },
        },
      })),
    });
    const before = dynamicChunkConvergenceStateKey(transaction(0), [1]);
    const after = dynamicChunkConvergenceStateKey(transaction(0x51), [1]);
    expect(after).not.toBe(before);
    expect(dynamicChunkConvergenceStateKey(transaction(0x51), [1])).toBe(after);
  });

  it('ignores a reserved placeholder when only the other chunk equality executes', () => {
    expect(dynamicChunkPlaceholdersRemain(builder, convergence([0]), incomplete)).toBe(false);
  });

  it('refuses a placeholder selected by an executed chunk equality', () => {
    expect(dynamicChunkPlaceholdersRemain(builder, convergence([1]), incomplete)).toBe(true);
  });

  it('keeps the missing-run fence when no owned chunk outputs exist', () => {
    expect(dynamicChunkPlaceholdersRemain(builder, {
      ...convergence([]), ownedOutputs: [],
    }, incomplete)).toBe(true);
  });
});
