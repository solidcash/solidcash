import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

type Handler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handler = (body: string, state = ''): Handler | undefined => compileString(`event Seen(int value);
  contract C() {
    int total;
    ${state}
    function apply(int limit, int initialDelta, int increment) public {
      ${body}
      require(limit >= 0 && limit <= 64);
    }
  }`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'apply');

describe('exact bounded additive recurrence replay', () => {
  it('admits truncating counter deltas by replaying each source operation', () => {
    expect(handler(`for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      this.total = this.total + cursor / 2;
      emit Seen(this.total);
    }`)).toMatchObject({ eligible: true });
  });

  it('forces a polynomial-looking bounded state delta through exact replay', () => {
    expect(handler(`for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      this.total = this.total + cursor;
      emit Seen(this.total);
    }`)).toMatchObject({ eligible: true });
  });

  it('expands a deterministic counter alias before exact bounded replay', () => {
    expect(handler(`for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      int current = cursor + 1;
      this.total = this.total + current;
      emit Seen(this.total);
    }`)).toMatchObject({ eligible: true });
  });

  it('keeps collection-derived and closure-mutated inputs fenced', () => {
    expect(handler(`for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      this.total = this.total + this.source[cursor]; emit Seen(this.total);
    }`, 'mapping(int => int) source;')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(handler(`for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      this.total = this.total + this.other; this.other = this.other + 1; emit Seen(this.total);
    }`, 'int other;')).toMatchObject({
      eligible: false, rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
