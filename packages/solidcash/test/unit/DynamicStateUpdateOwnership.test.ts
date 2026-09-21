import { describe, expect, it } from 'vitest';
import type { StateLayout } from '@solidcash/utils';
import {
  stateUpdatesTouchNft,
  stateVariableForUpdateKey,
} from '../../src/stateful/StatefulTransactionBuilder.js';

const layout = {
  variables: [
    { name: 'payload', type: 'bytes', dynamic: true, nftIndex: 2 },
    { name: 'count', type: 'uint256', nftIndex: 3 },
  ],
} as unknown as StateLayout;

describe('dynamic state update ownership', () => {
  it('maps a hidden dynamic length register to its owning data NFT', () => {
    expect(stateVariableForUpdateKey(layout, 'payload$len')?.nftIndex).toBe(2);
    expect(stateVariableForUpdateKey(layout, 'payload')?.nftIndex).toBe(2);
    expect(stateUpdatesTouchNft(layout, new Map([['payload$len', 3n]]), 2)).toBe(true);
  });

  it('does not infer hidden registers for non-dynamic or similarly named variables', () => {
    expect(stateVariableForUpdateKey(layout, 'count$len')).toBeUndefined();
    expect(stateVariableForUpdateKey(layout, 'payload$length')).toBeUndefined();
  });
});
