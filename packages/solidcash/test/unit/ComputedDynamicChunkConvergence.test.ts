import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  dynamicChunkPlaceholdersRemain,
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
