import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

describe('affine recursive mapping streams', () => {
  it.each([
    ['value', `function apply(int cursor, int offset) public returns (int) {
      if (cursor == 0) return offset;
      int result = apply(cursor - 1, offset);
      if (cursor % 2 == 1) emit Seen(cursor + offset);
      return result;
    }`],
    ['void', `function apply(int cursor, int offset) public {
      if (cursor == 0) return;
      apply(cursor - 1, offset);
      if (cursor % 2 == 1) emit Seen(cursor + offset);
      require(cursor >= 1);
    }`],
  ])('lowers replayable post-recursion events for a %s result', (_kind, fn) => {
    const artifact = compileString(`contract C() {
      event Seen(int value);
      ${fn}
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents).toEqual([
      expect.objectContaining({ eventSignatures: ['Seen(int256)'], conditions: [expect.anything()] }),
    ]);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(64);
  });

  it('publishes exact unwind sites, predicates, and invariant recursive results across source renaming', () => {
    const variants = [
      { contract: 'FirstShape', fn: 'fold', depth: 'remaining', seed: 'origin', result: 'resolved' },
      { contract: 'SecondShape', fn: 'advance', depth: 'cursor', seed: 'basis', result: 'answer' },
    ];
    const plans = variants.map((variant) => {
      const artifact = compileString(`contract ${variant.contract}() {
        event Selected(int value);
        event Visited(int value);
        function ${variant.fn}(int ${variant.depth}, int ${variant.seed}) public returns (int) {
          if (${variant.depth} == 0) return ${variant.seed} + 7;
          int ${variant.result} = ${variant.fn}(${variant.depth} - 1, ${variant.seed});
          if (${variant.result} > ${variant.depth}) emit Selected(${variant.result} + ${variant.depth});
          emit Visited(${variant.depth});
          return ${variant.result};
        }
      }`, KERNEL);
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === variant.fn);
      expect(handler).toMatchObject({ eligible: true });
      expect(handler?.runtimeLoopEvents).toEqual([
        expect.objectContaining({
          eventSignatures: ['Selected(int256)', 'Visited(int256)'],
          effectOrder: [0, 1],
          conditions: [expect.anything(), expect.anything()],
          arguments: [[expect.anything()], [expect.anything()]],
        }),
      ]);
      expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(2 * 64);
      return handler!.runtimeLoopEvents!.map((plan) => ({
        arguments: plan.arguments,
        conditions: plan.conditions,
        effectOrder: plan.effectOrder,
      }));
    });
    expect(plans[1]).toEqual(plans[0]);
  });

  it('retains one unwind event domain beside an independently permuted mapping stream', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      event Seen(int value);
      function fold(int depth, int seed) public returns (int) {
        if (depth == 0) return seed + 3;
        int result = fold(depth - 1, seed);
        this.values[depth] = result + depth;
        emit Seen(result + depth);
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'fold');
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [expect.objectContaining({
        iterationDomain: expect.anything(), eventSignatures: ['Seen(int256)'],
      })],
    });
    expect(artifact.abi.find((candidate) => candidate.name === 'fold')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'values', op: 'set' })]);
    // One event per frame, one mapping update per frame, and one mapping predecessor endpoint.
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(64 + 64 + 1);
  });

  it('lowers exact non-unit pre-order and unwind streams independently of source names', () => {
    const variants = [
      { contract: 'FirstStride', fn: 'apply', cursor: 'cursor', step: 'step', map: 'values' },
      { contract: 'SecondStride', fn: 'fold', cursor: 'position', step: 'stride', map: 'records' },
    ];
    const plans = variants.map((variant) => {
      const artifact = compileString(`contract ${variant.contract}() {
        mapping(int => int) ${variant.map};
        event Seen(int value);
        function ${variant.fn}(int ${variant.cursor}, int ${variant.step}) public returns (int) {
          if (${variant.cursor} == 0) return ${variant.step} + 5;
          int result = ${variant.fn}(${variant.cursor} - ${variant.step}, ${variant.step});
          this.${variant.map}[${variant.cursor}] = result + ${variant.cursor};
          emit Seen(result + ${variant.cursor});
          return result;
        }
      }`, KERNEL);
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === variant.fn);
      expect(handler).toMatchObject({
        eligible: true,
        runtimeLoopEvents: [expect.objectContaining({
          iterationDomain: expect.objectContaining({ maximumIterations: 64 }),
          eventSignatures: ['Seen(int256)'],
        })],
      });
      expect(artifact.abi.find((candidate) => candidate.name === variant.fn)?.sortedUpsertLoopInfo)
        .toEqual([expect.objectContaining({ collection: variant.map, op: 'set' })]);
      return {
        events: handler?.runtimeLoopEvents?.map((event) => ({
          iterationDomain: event.iterationDomain,
          arguments: event.arguments,
          conditions: event.conditions,
        })),
        capacity: artifact.messageBus?.route.blockLayout?.trailingCapacity,
      };
    });
    expect(plans[1]).toEqual(plans[0]);

    const preOrder = compileString(`contract PreOrderStride() {
      mapping(int => int) values;
      event Seen(int value);
      function descend(int cursor, int step) public returns (int) {
        this.values[cursor] = cursor + 10;
        emit Seen(cursor);
        if (cursor == 0) return 0;
        return descend(cursor - step, step);
      }
    }`, KERNEL);
    expect(preOrder.messageBus?.handlers.find((candidate) => candidate.name === 'descend'))
      .toMatchObject({ eligible: true, runtimeLoopEvents: [expect.anything()] });
    expect(preOrder.abi.find((candidate) => candidate.name === 'descend')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'values', op: 'set' })]);
  });

  it.each([
    ['a non-affine induction', 'walk(depth / 2, seed)', 'emit Seen(result + depth);'],
    ['a zero induction step', 'walk(depth - 0, seed)', 'emit Seen(result + depth);'],
    ['a wrong-direction induction', 'walk(depth + 2, seed)', 'emit Seen(result + depth);'],
    ['multiple varying arguments', 'walk(depth - 1, seed + 1)', 'emit Seen(result + depth);'],
    ['an ambiguous recursive occurrence',
      'depth % 2 == 0 ? walk(depth - 1, seed) : walk(depth - 1, seed)',
      'emit Seen(result + depth);'],
    ['a non-replayable result dependency', 'walk(depth - 1, seed)',
      'int adjusted = result + depth; emit Seen(adjusted);'],
  ])('keeps %s outside the post-recursion event plan', (_label, recursiveExpression, effects) => {
    expect(() => compileString(`contract C() {
        event Seen(int value);
        function walk(int depth, int seed) public returns (int) {
          if (depth == 0) return seed;
          int result = ${recursiveExpression};
          ${effects}
          return result;
        }
      }`, KERNEL)).toThrow(/event would be dropped|recursive/i);
  });

  it('keeps a state-derived recursive step outside the exact stream', () => {
    expect(() => compileString(`contract C() {
      int stride;
      event Seen(int value);
      function walk(int cursor) public returns (int) {
        if (cursor == 0) return 0;
        int result = walk(cursor - this.stride);
        emit Seen(result + cursor);
        return result;
      }
    }`, KERNEL)).toThrow(/event would be dropped|recursive/i);
  });

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

  it('authenticates post-recursion mapping reads as independent unwind streams', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) source;
      mapping(int => int) destination;
      function apply(int cursor, int fallbackValue) public returns (int) {
        if (cursor == 0) return fallbackValue;
        int result = apply(cursor - 1, fallbackValue);
        this.destination[cursor] = this.source[cursor] + result;
        return result;
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;

    expect(handler).toMatchObject({ eligible: true });
    expect(operationInfo?.map((info) => [info.collection, info.op])).toEqual([
      ['source', 'read'], ['destination', 'set'],
    ]);
    expect(artifact.messageBus?.route.blockLayout?.trailingCapacity).toBe(2 * 64 + 2);
  });

  it('admits same-collection recursive streams only when their full affine domains are disjoint', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function apply(int cursor) public returns (int) {
        if (cursor == 0) return 0;
        int result = apply(cursor - 1);
        this.values[cursor] = result;
        delete this.values[cursor + 64];
        return result;
      }
    }`, KERNEL);
    const operationInfo = artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo;

    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(operationInfo?.map((info) => [info.collection, info.op])).toEqual([
      ['values', 'set'], ['values', 'delete'],
    ]);
  });

  it('keeps same-entry RMW reads in their owning recursive transition', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function apply(int cursor, int increment) public returns (int) {
        if (cursor == 0) return increment;
        int result = apply(cursor - 1, increment);
        this.values[cursor] = this.values[cursor] + result;
        return result;
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo)
      .toEqual([expect.objectContaining({ collection: 'values', op: '+' })]);
  });

  it('proves disjoint same-collection domains using the exact constant recursive stride', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) values;
      function apply(int cursor) public returns (int) {
        if (cursor == 0) return 0;
        int result = apply(cursor - 2);
        this.values[cursor] = result;
        delete this.values[cursor + 1];
        return result;
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });
  });

  it.each([
    ['a zero recursive step', 'apply(cursor - 0, threshold)', 'this.selected[cursor] = result;'],
    ['a mutated invariant step', 'apply(cursor - threshold, threshold + 1)',
      'this.selected[cursor] = result;'],
    ['same-collection domains under a runtime stride', 'apply(cursor - threshold, threshold)',
      'this.selected[cursor] = result; delete this.selected[cursor + 64];'],
    ['overlapping post-recursion streams for one collection', 'apply(cursor - 1, threshold)',
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
