import { describe, expect, it, vi } from 'vitest';
import {
  assignSortedBatchProofOwners,
  planActiveSortedBatchMutation,
  routeCollectionValueWriteIsActive,
  selectMessageBusRouteEntryActivity,
  selectSortedBatchTraceCommitment,
  sortedBatchTraceCommitmentsShareNode,
  sortedBatchNoOutputReadSlots,
  sortedBatchReadOnlyProofOffsets,
  sortedBatchOperationsMutate,
  VMAP_BATCH_READ_ONLY_SENTINEL,
} from '../../src/stateful/sorted-batch-activity.js';

describe('active sorted-batch mutation planning', () => {
  it('does not allocate a transition for a route-union batch whose writer slots are all inactive', () => {
    const planner = vi.fn(() => ({ predecessorOutputs: ['phantom'] }));

    const planned = planActiveSortedBatchMutation(
      [21, 22, 23],
      new Set([21, 22, 23]),
      new Set(),
      planner,
    );

    expect(planned).toEqual({ activeSlotIndices: [] });
    expect(planner).not.toHaveBeenCalled();
  });

  it('plans only selected canonical writers, excluding inactive lanes and runtime aliases', () => {
    const planned = planActiveSortedBatchMutation(
      [4, 5, 6, 7],
      new Set([4]),
      new Set([6]),
      (activeSlotIndices) => ({ predecessorOutputs: [...activeSlotIndices] }),
    );

    expect(planned).toEqual({
      activeSlotIndices: [5, 7],
      mutationPlan: { predecessorOutputs: [5, 7] },
    });
  });

  it('does not turn a selected read lane into a collection mutation', () => {
    const operations = new Map<number, readonly string[]>([
      [8, ['read']],
      [9, ['read', 'write']],
    ]);
    const planned = planActiveSortedBatchMutation(
      [8, 9], new Set(), new Set(),
      (activeSlotIndices) => [...activeSlotIndices],
      (slotIndex) => sortedBatchOperationsMutate(operations.get(slotIndex) ?? []),
    );

    expect(planned).toEqual({ activeSlotIndices: [9], mutationPlan: [9] });
  });

  it('gives shared proof ownership to a mutating lane before read-only preservation', () => {
    const identities: Record<number, string> = {
      2: 'shared', 4: 'read-only', 6: 'shared', 8: 'read-only',
    };
    const owners = assignSortedBatchProofOwners(
      [2, 4, 6, 8],
      (slotIndex) => identities[slotIndex],
      (slotIndex) => slotIndex === 6,
    );

    expect([...owners.entries()]).toEqual([
      [6, 6],
      [2, 6],
      [4, 4],
      [8, 4],
    ]);
    expect(sortedBatchNoOutputReadSlots(
      [2, 4, 6, 8],
      owners,
      (slotIndex) => slotIndex === 6,
    )).toEqual([2, 8]);
  });

  it('projects unique read-only proof witnesses onto compiler-published fixed entry offsets', () => {
    const offsets = sortedBatchReadOnlyProofOffsets({
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'entry', offset: 5, slotIndex: 2 },
        { kind: 'entry', offset: 9, slotIndex: 7 },
        { kind: 'trailing', offset: 12 },
      ],
    }, {
      __internal__vmapBatchPredOut_2: VMAP_BATCH_READ_ONLY_SENTINEL,
      __internal__vmapBatchPredOut_7: -2n,
    });

    expect(offsets).toEqual([5]);
  });

  it('rejects a read-only proof witness without a matching physical entry slot', () => {
    expect(() => sortedBatchReadOnlyProofOffsets({
      slots: [{ kind: 'entry', offset: 3, slotIndex: 1 }],
    }, {
      __internal__vmapBatchPredOut_4: VMAP_BATCH_READ_ONLY_SENTINEL,
    })).toThrow(/slot 4 has no compiler-published entry offset/);
  });

  it('allocates value continuations only for concrete route writer lanes', () => {
    const activeOperations = new Map<number, readonly string[]>([
      [0, ['read']],
      [2, ['read', 'write']],
    ]);

    expect(routeCollectionValueWriteIsActive(
      0, 'accounts', ['read', 'write'], activeOperations, ['records'],
    )).toBe(false);
    expect(routeCollectionValueWriteIsActive(
      1, 'records', ['read', 'write'], activeOperations, ['records'],
    )).toBe(false);
    expect(routeCollectionValueWriteIsActive(
      2, 'records', ['read', 'write'], activeOperations, ['records'],
    )).toBe(true);
  });

  it('retains an authenticated value tail over a later structural batch observation', () => {
    const slot = '11'.repeat(32);
    const next = '22'.repeat(32);
    const structural = `${slot}${next}`;
    const withValue = `${structural}2a`;

    expect(selectSortedBatchTraceCommitment(structural, withValue)).toBe(withValue);
    expect(selectSortedBatchTraceCommitment(withValue, structural)).toBe(withValue);
    expect(selectSortedBatchTraceCommitment(withValue, `${structural}2b`)).toBe(`${structural}2b`);
    expect(selectSortedBatchTraceCommitment(undefined, structural)).toBe(structural);
    expect(sortedBatchTraceCommitmentsShareNode(structural, withValue)).toBe(true);
    expect(sortedBatchTraceCommitmentsShareNode(withValue, structural)).toBe(true);
    expect(sortedBatchTraceCommitmentsShareNode(withValue, `${structural}2b`)).toBe(false);
    expect(sortedBatchTraceCommitmentsShareNode(structural, `${'33'.repeat(32)}${next}`)).toBe(false);
  });
});

describe('message-bus route entry activity', () => {
  it('projects concrete rows onto their compiler-published physical entry lanes', () => {
    const activity = selectMessageBusRouteEntryActivity(
      [
        { collection: 'accounts', keyParams: ['__message_bus_key_accounts_0_r0'], operations: ['read', 'write'] },
        { collection: 'accounts', keyParams: ['__message_bus_key_accounts_0_r1'], operations: ['read', 'write'] },
        { collection: 'records', keyParams: ['__message_bus_key_records_0'], operations: ['read', 'write'] },
      ],
      [
        {
          name: 'readAccount', selector: '01020304', physicalEntrySlots: [0],
          batchKeyWitnesses: [{ routeInput: '__message_bus_key_accounts_0', perRow: true }],
        },
        {
          name: 'writeRecord', selector: '05060708', physicalEntrySlots: [2],
          batchKeyWitnesses: [{ routeInput: '__message_bus_key_records_0' }],
        },
      ],
      [
        {
          name: 'readAccount', selector: '01020304',
          entryAccesses: [{ collection: 'accounts', keyParams: ['account'], operations: ['read'] }],
        },
        {
          name: 'writeRecord', selector: '05060708',
          entryAccesses: [{ collection: 'records', keyParams: ['record'], operations: ['read', 'write'] }],
        },
      ],
    );

    expect(activity.inactiveSlotIndices).toEqual([1]);
    expect([...activity.activeOperations.entries()]).toEqual([
      [0, ['read']],
      [2, ['read', 'write']],
    ]);
    expect(activity.activeWriteCollections).toEqual(['records']);
  });

  it('marks unselected bounded row lanes inactive', () => {
    const activity = selectMessageBusRouteEntryActivity(
      [
        { collection: 'items', keyParams: ['__message_bus_key_items_0_r0'], operations: ['read', 'write'] },
        { collection: 'items', keyParams: ['__message_bus_key_items_0_r1'], operations: ['read', 'write'] },
      ],
      [{
        name: 'readItem', selector: '01020304', physicalEntrySlots: [0],
        batchKeyWitnesses: [{ routeInput: '__message_bus_key_items_0', perRow: true }],
      }],
      [{
        name: 'readItem', selector: '01020304',
        entryAccesses: [{ collection: 'items', keyParams: ['item'], operations: ['read'] }],
      }],
    );

    expect(activity.inactiveSlotIndices).toEqual([1]);
    expect([...activity.activeOperations.entries()]).toEqual([[0, ['read']]]);
    expect(activity.activeWriteCollections).toEqual([]);
  });

  it('marks unowned expression-backed union lanes inactive', () => {
    const activity = selectMessageBusRouteEntryActivity(
      [
        { collection: 'events', keyParams: ['__message_bus_key_events_0'], operations: ['read', 'write'] },
        {
          collection: 'events',
          keyParams: ['AbiDecodeAtNode{data=id:rowArgs,index=0,schema=[,]}'],
          operations: ['read'],
        },
      ],
      [{
        name: 'append', selector: '01020304', physicalEntrySlots: [0],
        batchKeyWitnesses: [{ routeInput: '__message_bus_key_events_0' }],
      }],
      [{
        name: 'append', selector: '01020304',
        entryAccesses: [{ collection: 'events', keyParams: ['id'], operations: ['read', 'write'] }],
      }],
    );

    expect(activity.inactiveSlotIndices).toEqual([1]);
    expect([...activity.activeOperations.entries()]).toEqual([[0, ['read', 'write']]]);
  });

  it('refuses an active handler whose compiler entry projection is incomplete', () => {
    expect(() => selectMessageBusRouteEntryActivity(
      [{ collection: 'events', keyParams: ['key'], operations: ['read'] }],
      [{ name: 'read', selector: '01020304' }],
      [{
        name: 'read', selector: '01020304',
        entryAccesses: [{ collection: 'events', keyParams: ['key'], operations: ['read'] }],
      }],
    )).toThrow(/missing a complete physical entry projection/);
  });
});
