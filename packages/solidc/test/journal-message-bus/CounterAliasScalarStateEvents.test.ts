import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('counter-alias scalar-state event recurrences', () => {
  it('publishes deterministic alias-chain phases over a non-unit loop domain', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function accumulate(int limit, int offset) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            int shifted = cursor + offset;
            int current = shifted * 2 + 1;
            this.total = this.total + current;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'accumulate');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
  });

  it.each([
    ['a reassigned alias', `int current = cursor + offset;
      current = current + 1; this.total = this.total + current;`],
    ['a conditional alias', `int current;
      if (offset > 0) { current = cursor; } else { current = cursor + 1; }
      this.total = this.total + current;`],
    ['a mapping-derived alias', `int current = this.source[cursor];
      this.total = this.total + current;`],
    ['a state-derived alias', `int current = this.other;
      this.total = this.total + current;`],
    ['a truncating alias', `int current = cursor / 2;
      this.total = this.total + current;`],
    ['a continue-crossed alias recurrence', `int current = cursor + offset;
      this.total = this.total + current; if (offset > 0) { continue; }`],
    ['a break-crossed alias recurrence', `int current = cursor + offset;
      this.total = this.total + current; if (offset > 0) { break; }`],
  ])('keeps %s fenced', (_label, body) => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        int other;
        mapping(int => int) source;
        function accumulate(int limit, int offset) public {
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            ${body}
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps an effectful helper result alias fenced', () => {
    const artifact = compileString(`event Phase(int value); event Auxiliary(int value);
      contract C() {
        int total;
        function derive(int value) internal returns (int) {
          emit Auxiliary(value);
          return value + 1;
        }
        function accumulate(int limit) public {
          for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
            int current = derive(cursor);
            this.total = this.total + current;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
