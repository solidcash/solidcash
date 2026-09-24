import { describe, expect, it } from 'vitest';
import { dynamicChunkPlaceholdersRemain } from '../../../src/message-bus/computed-dynamic-chunks.js';

describe('dynamicChunkPlaceholdersRemain (J7)', () => {
  const builder = { outputs: [] } as never;

  it('empty incomplete list is complete', () => {
    expect(dynamicChunkPlaceholdersRemain(builder, { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] }, []))
      .toBe(false);
  });

  it('resolved=0 stubs with no owned trailing run are empty/inactive, not incomplete', () => {
    expect(dynamicChunkPlaceholdersRemain(
      builder,
      { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] },
      [{ participant: 0, variable: 'dormant', resolved: 0, total: 1 }],
    )).toBe(false);
  });

  it('resolved>0 with no owned trailing run is still incomplete', () => {
    expect(dynamicChunkPlaceholdersRemain(
      builder,
      { repairs: 0, rounds: 0, ownedOutputs: [], outputs: [] },
      [{ participant: 0, variable: 'dormant', resolved: 1, total: 2 }],
    )).toBe(true);
  });

  it('owned trailing 00 commitment remains incomplete', () => {
    const withPlaceholder = {
      outputs: [
        {},
        { token: { nft: { commitment: '00', capability: 'mutable' } } },
      ],
    } as never;
    expect(dynamicChunkPlaceholdersRemain(
      withPlaceholder,
      { repairs: 0, rounds: 0, ownedOutputs: [1], outputs: [1] },
      [{ participant: 0, variable: 'dormant', resolved: 0, total: 1 }],
    )).toBe(true);
  });
});
