import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('affine recursive mapping streams', () => {
  it('lowers void post-recursion effects with replayable requirements', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) selected;
      mapping(int => int) removed;
      function apply(int cursor, int threshold) public {
        if (cursor == 0) return;
        apply(cursor - 1, threshold);
        if (cursor > threshold) this.selected[cursor] = cursor + 30;
        else delete this.removed[cursor + 1];
        require(cursor >= 1);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;
    expect(handler).toMatchObject({ eligible: true });
    expect(operationInfo?.map((info) => [info.collection, info.op])).toEqual([
      ['selected', 'set'], ['removed', 'delete'],
    ]);
    expect(operationInfo?.every((info) => info.iterationCondition !== undefined)).toBe(true);
  });

  it('lowers post-recursion sets and deletes in call-stack unwind order', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) selected;
      mapping(int => int) removed;
      function apply(int cursor, int threshold) public returns (int) {
        if (cursor == 0) return threshold;
        int result = apply(cursor - 1, threshold);
        if (cursor > threshold) this.selected[cursor + 1] = result + cursor;
        else delete this.removed[cursor - 1];
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;

    expect(handler).toMatchObject({ eligible: true });
    expect(operationInfo?.map((info) => [info.collection, info.op])).toEqual([
      ['selected', 'set'], ['removed', 'delete'],
    ]);
    expect(operationInfo?.every((info) => info.iterationCondition !== undefined)).toBe(true);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(2 * 64 + 2);
  });

  it.each([
    ['a non-unit recursive step', 'apply(cursor - 2, threshold)', 'this.selected[cursor] = result;'],
    ['a post-recursion mapping read', 'apply(cursor - 1, threshold)',
      'this.selected[cursor] = this.removed[cursor];'],
    ['two post-recursion streams for one collection', 'apply(cursor - 1, threshold)',
      'this.selected[cursor] = result; delete this.selected[cursor + 1];'],
  ])('keeps %s outside the unwind stream', (_label, recursiveCall, operations) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) selected;
      mapping(int => int) removed;
      function apply(int cursor, int threshold) public returns (int) {
        if (cursor == 0) return threshold;
        int result = ${recursiveCall};
        ${operations}
        return result;
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('lowers source-ordered sets and deletes across independent collections', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) left;
      mapping(int => int) right;
      mapping(int => int) finalValues;
      function apply(int cursor) public returns (int) {
        this.left[cursor] = cursor;
        delete this.right[cursor + 2];
        this.finalValues[cursor - 1] = cursor + 10;
        if (cursor == 0) return 0;
        return apply(cursor - 1);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;

    expect(handler).toMatchObject({ eligible: true });
    expect(operationInfo).toEqual([
      expect.objectContaining({ collection: 'left', op: 'set' }),
      expect.objectContaining({ collection: 'right', op: 'delete' }),
      expect.objectContaining({ collection: 'finalValues', op: 'set' }),
    ]);
    // Each independently keyed stream reserves 64 operations plus its own authenticated predecessor.
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(3 * 64 + 3);
  });

  it('publishes replayable predicates for conditional operations, including false frames', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) evenValues;
      mapping(int => int) highValues;
      mapping(int => int) alternateValues;
      function apply(int cursor, int threshold) public returns (int) {
        if (cursor % 2 == 0) this.evenValues[cursor] = cursor + 20;
        if (cursor > threshold) {
          delete this.highValues[cursor + 1];
        } else {
          this.alternateValues[cursor - 1] = threshold;
        }
        if (cursor == 0) return threshold;
        return apply(cursor - 1, threshold);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;

    expect(handler).toMatchObject({ eligible: true });
    expect(operationInfo).toHaveLength(3);
    expect(operationInfo?.map((info) => [info.collection, info.op])).toEqual([
      ['evenValues', 'set'], ['highValues', 'delete'], ['alternateValues', 'set'],
    ]);
    expect(operationInfo?.every((info) => info.iterationCondition !== undefined)).toBe(true);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(3 * 64 + 3);
  });

  it.each([
    ['non-affine key', 'this.left[cursor] = cursor; delete this.right[cursor * 2];'],
    ['two streams for one collection', 'this.left[cursor] = cursor; delete this.left[cursor + 1];'],
    ['a cross-stream mapping read', 'this.left[cursor] = this.right[cursor]; this.right[cursor + 1] = cursor;'],
    ['a state-dependent predicate', 'this.left[cursor] = cursor; if (this.right[cursor] > 0) delete this.right[cursor + 1];'],
    ['a local-dependent predicate', 'int selected = cursor + 1; this.left[cursor] = cursor; if (selected > 2) delete this.right[cursor];'],
  ])('keeps %s outside the affine stream', (_label, operations) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) left;
      mapping(int => int) right;
      function apply(int cursor) public returns (int) {
        ${operations}
        if (cursor == 0) return 0;
        return apply(cursor - 1);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'control'))
      .toMatchObject({ eligible: true });
  });
});
