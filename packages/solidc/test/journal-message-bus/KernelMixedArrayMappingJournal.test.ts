import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel mixed dynamic-array and mapping journals', () => {
  it('admits independent array and entry indices without shape-specific names', () => {
    const artifact = compileString(`contract NeutralStore() {
      int[] sequence;
      mapping(int => int) records;
      function revise(int position, int key, int value) public {
        this.sequence[position] = value;
        this.records[key] = this.sequence[position] + 100;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'revise'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(artifact.abi.find((entry) => entry.name === 'revise')).toMatchObject({
      dynamicReads: ['sequence'], dynamicWrites: ['sequence'],
    });
  });

  it('threads every chunk-backed array touched beside the entry journal', () => {
    const artifact = compileString(`contract ParallelState() {
      int[] left;
      int[] right;
      mapping(int => int) totals;
      function replace(int leftIndex, int rightIndex, int key, int value) public {
        this.left[leftIndex] = value;
        this.totals[key] = this.left[leftIndex] + 1;
        this.right[rightIndex] = this.totals[key] + 1;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'replace')).toMatchObject({
      dynamicReads: ['left', 'right'], dynamicWrites: ['left', 'right'],
    });
  });
});
