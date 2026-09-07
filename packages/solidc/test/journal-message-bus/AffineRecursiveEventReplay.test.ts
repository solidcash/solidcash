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

  it('keeps a changing-step pre-order recurrence outside the affine replay subset', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value) public {
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
    ['a changing step', 'descend(cursor - 1, value + cursor, reverse - 3)'],
    ['a nonlinear progression', 'descend(cursor - 1, value * 2, reverse - 3)'],
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

  it('keeps a changing-step recurrence outside the affine replay subset', () => {
    const handler = selected(`contract C() {
      event Seen(bigint value);
      function descend(bigint cursor, bigint value) public {
        emit Seen(value);
        if (cursor == 0) return;
        descend(cursor - 1, value + cursor);
        emit Seen(value);
      }
      function control() public { require(true); }
    }`);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
