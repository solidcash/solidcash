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

  it.each(['bytes', 'string'] as const)(
    'admits a chunk-backed %s state write beside an independent mapping journal', (type) => {
      const concat = type === 'bytes' ? 'bytes.concat' : 'string.concat';
      const artifact = compileString(`contract ParallelScalarState() {
        ${type} payload;
        mapping(int => int) lengths;
        function append(int key, ${type} suffix) public {
          this.payload = ${concat}(this.payload, suffix);
          this.lengths[key] = this.payload.length;
          require(true);
        }
      }`, KERNEL);
      expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
        .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
      expect(artifact.abi.find((entry) => entry.name === 'append')).toMatchObject({
        dynamicReads: ['payload'], dynamicWrites: ['payload'],
      });
      expect(artifact.messageBus?.route.blockLayout?.slots).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'entry', slotIndex: 0 }),
        expect.objectContaining({ kind: 'trailing', slotIndex: 0 }),
      ]));
    },
  );

  it('admits a chunk-backed scalar write beside a token-container read', () => {
    const artifact = compileString(`contract ParallelTokenState() {
      bytes payload;
      function append(bytes32 category, bytes suffix) public {
        this.payload = bytes.concat(this.payload, suffix);
        bytes commitment = this.tokens[category].nftCommitment;
        require(this.tokens[category].tokenAmount >= 0);
        require(commitment == commitment);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((entry) => entry.name === 'append')).toMatchObject({
      dynamicReads: ['payload'], dynamicWrites: ['payload'],
      tokenContainerAccesses: [expect.objectContaining({ operations: ['read'] })],
    });
    expect(artifact.messageBus?.route.blockLayout?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tokenContainer', slotIndex: 0 }),
      expect.objectContaining({ kind: 'trailing', slotIndex: 0 }),
    ]));
  });
});
