import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { encodePushdataValue, sha256 as sha256Sync } from '@solidcash/utils';
import {
  selectAuthenticatedCollectionValue,
  selectAuthenticatedPreValueWitness,
} from '../../src/stateful/StatefulContract.js';

describe('authenticated collection value recovery', () => {
  it('selects the final authenticated value when a batch exposes intermediate writes', () => {
    const intermediate = Uint8Array.from({ length: 40 }, (_, index) => index + 1);
    const final = Uint8Array.from({ length: 64 }, (_, index) => 255 - index);
    const roots = new Set([intermediate, final].map((value) => binToHex(sha256Sync(value))));

    expect(selectAuthenticatedCollectionValue(
      [intermediate, final], roots, roots, undefined, undefined,
    )).toEqual(final);
  });

  it('ignores malformed rooted candidates and preserves preferred-root priority', () => {
    const preferred = encodePushdataValue(Uint8Array.from({ length: 64 }, (_, index) => index), 'bytes');
    const fallback = encodePushdataValue(Uint8Array.from({ length: 64 }, (_, index) => 255 - index), 'bytes');
    const malformed = Uint8Array.from({ length: 64 }, (_, index) => index === 0 ? 0x4d : 0xff);
    const root = (value: Uint8Array): string => binToHex(sha256Sync(value));
    const roots = new Set([preferred, fallback, malformed].map(root));

    expect(selectAuthenticatedCollectionValue(
      [preferred, fallback, malformed], roots, new Set([root(preferred), root(malformed)]), 'bytes', undefined,
    )).toEqual(preferred);
  });

  it('never promotes a trace-only derived root into the pre-value witness', () => {
    const derived = encodePushdataValue(Uint8Array.from({ length: 64 }, (_, index) => index), 'bytes');
    const root = binToHex(sha256Sync(derived));

    expect(selectAuthenticatedPreValueWitness(
      [derived], new Set(), 'bytes', undefined,
    )).toBeUndefined();
    expect(selectAuthenticatedPreValueWitness(
      [derived], new Set([root]), 'bytes', undefined,
    )).toEqual(derived);
  });
});
