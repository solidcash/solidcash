import { describe, expect, it } from 'vitest';
import {
  orderedActiveTrailingEntryCollections,
  orderedTrailingEntryCollections,
} from '../../src/stateful/StatefulContract.js';

describe('trailing entry output order', () => {
  it('preserves the effective physical ABI batch order ahead of runtime discoveries', () => {
    const ordered = orderedTrailingEntryCollections(
      [
        { collection: 'accounts' },
        { collection: 'events' },
        { collection: 'reviews' },
      ],
      ['events'],
      ['reviews', 'pending'],
      ['accounts', 'receipts'],
    );

    expect(ordered).toEqual(['accounts', 'events', 'reviews', 'pending', 'receipts']);
  });

  it('retains stable runtime discovery order when no fixed batches are published', () => {
    expect(orderedTrailingEntryCollections(
      undefined,
      ['events', 'events'],
      ['records', 'events'],
    )).toEqual(['events', 'records']);
  });

  it('does not allocate inactive union batches for a concrete routed envelope', () => {
    expect(orderedActiveTrailingEntryCollections(
      [
        { collection: 'inactiveBefore' },
        { collection: 'activeSecond' },
        { collection: 'activeFirst' },
        { collection: 'inactiveAfter' },
      ],
      ['activeFirst'],
      ['activeSecond', 'runtimeOnly'],
    )).toEqual(['activeSecond', 'activeFirst', 'runtimeOnly']);
  });
});
