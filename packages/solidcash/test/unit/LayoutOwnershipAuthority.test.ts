import { describe, expect, it } from 'vitest';
import {
  assertUniqueOwnership,
  resolveTransactionLayout,
  type ResourceOwnershipClaim,
} from '../../src/message-bus/layout-resolver.js';

const baseClaim = (
  overrides: Partial<ResourceOwnershipClaim> & { roles: ResourceOwnershipClaim['roles'] },
): ResourceOwnershipClaim => ({
  participant: 0,
  carrier: 'entry',
  collection: 'events',
  ...overrides,
});

describe('layout ownership authority (item 2)', () => {
  it('rejects two distinct resources claiming the same output coordinate', () => {
    expect(() => assertUniqueOwnership([
      baseClaim({ collection: 'left', roles: { outputSlot: 10 } }),
      baseClaim({ collection: 'right', roles: { outputSlot: 10 } }),
    ])).toThrow(/coordinate-collision/);
  });

  it('rejects conflicting roles on the same identity', () => {
    expect(() => assertUniqueOwnership([
      baseClaim({ roles: { outputSlot: 10 } }),
      baseClaim({ roles: { outputSlot: 11 } }),
    ])).toThrow(/conflicting-roles|duplicate-ownership/);
  });

  it('rejects overlapping variable-width ranges', () => {
    expect(() => assertUniqueOwnership([
      baseClaim({ collection: 'a', rangeWidth: 3, roles: { outputSlot: 10 } }),
      baseClaim({ collection: 'b', rangeWidth: 2, roles: { outputSlot: 12 } }),
    ])).toThrow(/overlapping-range/);
  });

  it('rejects claims that cross participant bounds or fixed suffix', () => {
    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: {
          blockSize: 20,
          trailingBase: 5,
          trailingCapacity: 10,
        },
      }],
      ownership: [
        baseClaim({ roles: { outputSlot: 100 } }),
      ],
    })).toThrow(/participant-boundary/);

    expect(() => resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: {
          blockSize: 20,
          trailingBase: 5,
          trailingCapacity: 10,
        },
      }],
      ownership: [
        // absolute output in fixed-suffix: trailing 5+10=15 → suffix starts at inputBase+15
        baseClaim({ roles: { outputSlot: 16 } }),
      ],
    })).toThrow(/fixed-suffix-crossing|participant-boundary/);
  });

  it('accepts non-overlapping claims inside the participant trailing band', () => {
    const layout = resolveTransactionLayout({
      participants: [{
        participant: 0,
        blockLayout: { blockSize: 20, trailingBase: 5, trailingCapacity: 10 },
      }],
      ownership: [
        baseClaim({ collection: 'a', roles: { outputSlot: 6 } }),
        baseClaim({ collection: 'b', roles: { outputSlot: 8 } }),
      ],
      valueChunkClaims: [{
        participant: 0,
        collection: 'a',
        bandOffset: 0,
        chunkCount: 1,
      }],
    });
    expect(layout.valueChunkBands[0]?.absoluteBase).toBe(5);
  });
});
