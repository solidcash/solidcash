import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

type KernelHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const selected = (source: string): KernelHandler | undefined => compileString(source, KERNEL).messageBus?.handlers
  .find((handler) => handler.name === 'descend');

describe('affine recursive event replay', () => {
  it('admits a finite pre-order stream with multiple invariant affine parameters', () => {
    const handler = selected(`contract C() {
      event Seen(bigint cursor, bigint value, bigint reverse);
      function descend(bigint cursor, bigint value, bigint reverse, bigint stride, bigint delta) public {
        emit Seen(cursor, value, reverse);
        if (cursor == 0) return;
        descend(cursor - stride, value + delta, reverse - 3, stride, delta);
      }
    }`);
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: {
          initialValue: { value: '0' }, stepValue: { value: '1' }, maximumIterations: 64,
        },
      }],
    });
  });

  it('admits a bigint affine-counter pre-order recurrence', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint stride, bigint bias) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - stride, value + cursor + bias, stride, bias);
      }
    }`);
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{ iterationDomain: { maximumIterations: 64 } }],
    });
  });

  it.each(['int', 'uint8'])('keeps checked %s counter progression outside closed-form replay', (type) => {
    const handler = selected(`contract C() {
      event Seen(${type} value);
      function descend(${type} cursor, ${type} value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 1, value + cursor);
      }
      function control() public { require(true); }
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('admits non-void unwind events over independent affine parameters', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value, bigint reverse);
      function descend(bigint cursor, bigint value, bigint reverse, bigint stride, bigint delta)
        public returns (bigint) {
        if (cursor == 0) return 7;
        bigint result = descend(cursor - stride, value + delta, reverse - 3, stride, delta);
        if (value % 2 == 0) emit Seen(value, reverse);
        return result;
      }
    }`);
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [{
        iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 },
      }],
    });
  });

  it.each([
    ['a nonlinear recurrence', 'descend(cursor - 1, value * 2, reverse - 3)'],
    ['nonlinear counter multiplication', 'descend(cursor - 1, value + cursor * cursor, reverse - 3)'],
    ['coupled changing parameters', 'descend(cursor - 1, value + reverse, reverse - 3)'],
  ])('keeps non-void unwind replay outside the affine subset for %s', (
    _label, recursiveCall, baseReturn = '7',
  ) => {
    expect(() => selected(`contract C() {
        event Seen(bigint value);
        function descend(bigint cursor, bigint value, bigint reverse) public returns (bigint) {
          if (cursor == 0) return ${baseReturn};
          bigint result = ${recursiveCall};
          emit Seen(value + reverse);
          return result;
        }
        function control() public { require(true); }
      }`)).toThrow(/emits an event and is invoked internally|KERNEL_LAYOUT/);
  });

  it('admits affine-counter progression during non-void unwind', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint stride, bigint bias) public returns (bigint) {
        if (cursor == 0) return value;
        bigint result = descend(cursor - stride, value + 2 * cursor + bias, stride, bias);
        emit Seen(value + result);
        return result;
      }
    }`);
    expect(handler).toMatchObject({ eligible: true, runtimeLoopEvents: [expect.anything()] });
  });

  it('reconstructs changing auxiliary parameters in the terminal base return', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint reverse) public returns (bigint) {
        if (cursor == 0) return value - reverse;
        bigint result = descend(cursor - 1, value + 2, reverse - 3);
        emit Seen(value + result);
        return result;
      }
    }`);
    expect(handler).toMatchObject({ eligible: true });
  });

  it.each([
    ['a state read', 'this.saved'],
    ['an opaque function call', 'identity(value)'],
  ])('rejects terminal base reconstruction containing %s', (_label, baseReturn) => {
    expect(() => selected(`contract C() {
        bigint saved;
        event Seen(bigint value);
        function identity(bigint x) internal pure returns (bigint) { return x; }
        function descend(bigint cursor, bigint value) public returns (bigint) {
          if (cursor == 0) return ${baseReturn};
          bigint result = descend(cursor - 1, value + 2);
          emit Seen(value);
          return result;
        }
        function control() public { require(true); }
      }`)).toThrow(/emits an event and is invoked internally|KERNEL_LAYOUT/);
  });

  it('admits a finite mixed-order stream with multiple affine parameters', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint delta) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 2, value + delta, delta);
        emit Seen(value);
      }
    }`);
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [
        { iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 } },
        { iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 } },
      ],
    });
  });

  it('admits an affine-counter recurrence across mixed source phases', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value, bigint invariant) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 2, value + cursor + invariant, invariant);
        emit Seen(value);
      }
    }`);
    expect(handler).toMatchObject({
      eligible: true,
      runtimeLoopEvents: [
        { iterationDomain: { initialValue: { value: '0' }, maximumIterations: 64 } },
        { iterationDomain: { initialValue: { value: '1' }, maximumIterations: 64 } },
      ],
    });
  });

  it.each([
    ['state dependence', 'value + this.saved'],
    ['resource dependence', 'value + this.values[cursor]'],
    ['an opaque effectful call', 'value + opaque(cursor)'],
    ['integer division of the counter', 'value + cursor / 2'],
  ])('rejects affine-looking progression with %s', (_label, nextValue) => {
    let admitted = false;
    try {
      admitted = selected(`contract C() {
      bigint saved;
      mapping(bigint => bigint) values;
      event Seen(bigint value);
      function opaque(bigint value) internal returns (bigint) { this.saved = value; return value; }
      function descend(bigint cursor, bigint value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 1, ${nextValue});
      }
      function control() public { require(true); }
      }`)?.eligible === true;
    } catch {
      // A pre-codegen recursive/resource diagnostic is also a fail-closed result.
    }
    expect(admitted).toBe(false);
  });

  it.each([
    ['a non-decreasing cursor', 'cursor + 1'],
    ['an ambiguous branch termination', 'cursor % 2 == 0 ? cursor - 1 : cursor - 1'],
  ])('does not claim affine-counter replay with %s', (_label, nextCursor) => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(${nextCursor}, value + cursor);
      }
      function control() public { require(true); }
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('does not extend affine-counter event replay through an unproven mutual cycle', () => {
    let admitted = false;
    try {
      const artifact = compileString(`contract C() {
        event Seen(bigint value);
        function left(bigint cursor, bigint value) public {
          emit Seen(value);
          if (cursor == 0) return;
          right(cursor - 1, value + cursor);
        }
        function right(bigint cursor, bigint value) internal {
          emit Seen(value);
          if (cursor == 0) return;
          left(cursor - 1, value + cursor);
        }
        function control() public { require(true); }
      }`, KERNEL);
      admitted = artifact.messageBus?.handlers.find((handler) => handler.name === 'left')?.eligible === true;
    } catch {
      // An internal-event or recursive-cycle diagnostic is also the required refusal.
    }
    expect(admitted).toBe(false);
  });
});
