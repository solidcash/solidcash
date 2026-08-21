import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { sha256 as sha256Sync } from '@solidcash/utils';
import { selectAuthenticatedCollectionValue } from '../../src/stateful/StatefulContract.js';

describe('authenticated collection value recovery', () => {
  it('selects the final authenticated value when a batch exposes intermediate writes', () => {
    const intermediate = Uint8Array.from({ length: 40 }, (_, index) => index + 1);
    const final = Uint8Array.from({ length: 64 }, (_, index) => 255 - index);
    const roots = new Set([intermediate, final].map((value) => binToHex(sha256Sync(value))));

    expect(selectAuthenticatedCollectionValue(
      [intermediate, final], roots, roots, undefined, undefined,
    )).toEqual(final);
  });
});
