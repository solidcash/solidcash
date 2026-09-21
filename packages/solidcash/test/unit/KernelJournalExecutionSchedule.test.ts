import { describe, expect, it } from 'vitest';
import {
  scheduleKernelEntryJournalOccurrences,
  type KernelEntryJournalExecutionStream,
} from '../../src/stateful/KernelEntryJournal.js';

type Stream = KernelEntryJournalExecutionStream & { values: readonly string[] };

const schedule = (streams: readonly Stream[]): string[] => scheduleKernelEntryJournalOccurrences(
  streams,
  (stream) => stream.values,
).map(({ value }) => value);

describe('kernel journal execution schedule', () => {
  it('uses compiler coordinates rather than stream insertion order and interleaves sites within one loop', () => {
    const streams: Stream[] = [
      {
        frameIndex: 1, executionGroup: 0, executionOrder: 0, accessStreamIndex: 0,
        values: ['frame-1'],
      },
      {
        frameIndex: 0, executionGroup: 10, executionOrder: 2, accessStreamIndex: 2,
        values: ['group-10'],
      },
      {
        frameIndex: 0, executionGroup: 2, executionOrder: 3, accessStreamIndex: 3,
        values: ['group-2'],
      },
      {
        frameIndex: 0, executionGroup: 0, executionOrder: 1, accessStreamIndex: 1,
        sourceOccurrences: [0, 2], values: ['B0', 'B2'],
      },
      {
        frameIndex: 0, executionGroup: 0, executionOrder: 0, accessStreamIndex: 0,
        sourceOccurrences: [0, 2], values: ['A0', 'A2'],
      },
    ];

    const expected = ['A0', 'B0', 'A2', 'B2', 'group-2', 'group-10', 'frame-1'];
    expect(schedule(streams)).toEqual(expected);
    expect(schedule([...streams].reverse())).toEqual(expected);
  });

  it('rejects duplicate stream and execution-site coordinates', () => {
    const base: Stream = {
      frameIndex: 0, executionGroup: 0, executionOrder: 0, accessStreamIndex: 0, values: ['A'],
    };
    expect(() => schedule([base, { ...base, executionGroup: 1, executionOrder: 1 }]))
      .toThrow('repeats access stream coordinate 0:0');
    expect(() => schedule([base, { ...base, accessStreamIndex: 1 }]))
      .toThrow('repeats execution site coordinate 0:0:0');
  });

  it('rejects malformed runtime occurrence coordinates rather than inventing an order', () => {
    const base: Stream = {
      frameIndex: 0, executionGroup: 0, executionOrder: 0, accessStreamIndex: 0,
      sourceOccurrences: [1], values: ['A'],
    };
    expect(() => schedule([{ ...base, sourceOccurrences: [] }]))
      .toThrow('has 1 accesses but 0 source occurrences');
    expect(() => schedule([{ ...base, sourceOccurrences: [2, 1], values: ['A', 'B'] }]))
      .toThrow('source occurrences are not strictly ordered');
    expect(() => schedule([{ ...base, executionGroup: Number.NaN }]))
      .toThrow('execution group must be a non-negative safe integer');
  });
});
