import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel mixed runtime and fixed collection access', () => {
  it('admits one exact fixed transition beside a runtime stream on the same collection', () => {
    const artifact = compileString(`contract HelperJournalFence() {
      mapping(int => int) records;
      mapping(int => int) flags;

      function fill(int count, int base) internal {
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[base + cursor] = cursor + 1;
        }
      }

      function apply(int count, int base) public {
        fill(count, base);
        this.records[999] = count;
        require(true);
      }

      function direct(int count, int base) public {
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[base + cursor] = cursor + 1;
        }
        this.records[999] = count;
        require(true);
      }

      function helperOnly(int count, int base) public {
        fill(count, base);
        require(true);
      }

      function separateCollection(int count, int base) public {
        fill(count, base);
        this.flags[999] = count;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({
        eligible: true,
        batchKeyWitnesses: [expect.objectContaining({ source: 'expression', expressionLabel: 'const:999' })],
        physicalEntrySlots: [expect.any(Number)],
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'direct'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [expect.any(Number)] });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'helperOnly'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'separateCollection'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [expect.any(Number)] });

    const isolated = compileString(`contract DirectMixed() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[base + cursor] = cursor + 1;
        }
        this.records[999] = count;
        require(true);
      }
    }`, KERNEL);
    expect(isolated.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [expect.any(Number)] });
    const applyAbi = isolated.abi.find((candidate) => candidate.name === 'apply');
    expect(applyAbi?.entryAccesses).toEqual([
      expect.objectContaining({ collection: 'records', operations: ['write'], valueSource: 'id:count' }),
    ]);
    expect(applyAbi?.sortedUpsertLoopInfo).toEqual([
      expect.objectContaining({ collection: 'records', op: 'set' }),
    ]);
    expect(applyAbi?.inputs.some((input) => input.name === '__internal__vmapBatchTrailingCount')).toBe(true);
  });
});
