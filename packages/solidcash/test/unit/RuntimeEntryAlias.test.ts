import { describe, expect, it } from 'vitest';
import { runtimeEntryAliasOwners } from '../../src/stateful/StatefulContract.js';

describe('runtime entry proof aliases', () => {
  it('does not deactivate distinct targets that share one predecessor proof', () => {
    const owners = runtimeEntryAliasOwners([
      {
        slotIndex: 0,
        collection: 'items',
        priorSlots: [],
        target: 'target-a',
        proof: 'proof:0',
        operations: ['read'],
      },
      {
        slotIndex: 1,
        collection: 'items',
        priorSlots: [0],
        target: 'target-b',
        proof: 'proof:0',
        operations: ['read'],
      },
      {
        slotIndex: 2,
        collection: 'items',
        priorSlots: [],
        target: 'target-c',
        proof: 'proof:0',
        operations: ['read'],
      },
    ]);

    expect(owners.size).toBe(0);
  });

  it('does not collapse distinct writes merely because they share a predecessor proof', () => {
    const owners = runtimeEntryAliasOwners([
      {
        slotIndex: 3,
        collection: 'balances',
        priorSlots: [],
        target: 'alice',
        proof: 'proof:7',
        operations: ['write'],
      },
      {
        slotIndex: 4,
        collection: 'balances',
        priorSlots: [3],
        target: 'bob',
        proof: 'proof:7',
        operations: ['write'],
      },
    ]);

    expect(owners.size).toBe(0);
  });

  it('aliases only equal runtime targets to an active physical owner', () => {
    const owners = runtimeEntryAliasOwners([
      {
        slotIndex: 5,
        collection: 'labels',
        priorSlots: [],
        target: 'same-key',
        proof: 'proof:9',
        operations: ['write'],
      },
      {
        slotIndex: 6,
        collection: 'labels',
        priorSlots: [5],
        target: 'same-key',
        proof: 'proof:9',
        operations: ['write'],
      },
      {
        slotIndex: 7,
        collection: 'labels',
        priorSlots: [6],
        target: 'another-key',
        proof: 'proof:9',
        operations: ['read'],
      },
    ]);

    expect([...owners]).toEqual([[6, 5]]);
  });

  it('shares one physical proof for equal read lanes', () => {
    const owners = runtimeEntryAliasOwners([
      {
        slotIndex: 8,
        collection: 'labels',
        priorSlots: [],
        target: 'same-key',
        proof: 'proof:10',
        operations: ['read'],
      },
      {
        slotIndex: 9,
        collection: 'labels',
        priorSlots: [8],
        target: 'same-key',
        proof: 'proof:10',
        operations: ['read'],
      },
    ]);

    expect([...owners]).toEqual([[9, 8]]);
  });

  it('shares an authenticated proof with an equal read lane', () => {
    const entries = [
      {
        slotIndex: 10, collection: 'records', priorSlots: [], target: 'same-key',
        proof: 'proof:11', operations: ['read', 'write'],
      },
      {
        slotIndex: 11, collection: 'records', priorSlots: [10], target: 'same-key',
        proof: 'proof:11', operations: ['read'],
      },
    ];
    expect([...runtimeEntryAliasOwners(entries)]).toEqual([[11, 10]]);
    expect(runtimeEntryAliasOwners(entries.map((entry) => (
      entry.slotIndex === 11 ? { ...entry, proof: 'proof:12' } : entry
    ))).size).toBe(0);
  });
});
