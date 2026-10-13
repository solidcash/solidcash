import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

type MessageBusHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handlerFor = (body: string): MessageBusHandler | undefined =>
  compileString(`event Phase(bigint value); event Auxiliary(int value);
  contract C() {
    bigint total;
    int other;
    mapping(int => int) source;
    function derive(int value) internal returns (int) { emit Auxiliary(value); return value + 1; }
    function accumulate(int limit, bigint initialDelta, bigint increment, bool flag) public {
      bigint delta = initialDelta;
      bigint coupled = 1;
      for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
        ${body}
        emit Phase(this.total);
      }
      require(true);
    }
  }`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'accumulate');

describe('loop-carried delta scalar-state event recurrences', () => {
  it('publishes both source phases for an affine local over a non-unit domain', () => {
    const artifact = compileString(`event Phase(bigint value);
      contract C() {
        bigint total;
        function accumulate(int limit, bigint initialDelta, bigint increment) public {
          bigint delta = initialDelta;
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            this.total = this.total + delta;
            emit Phase(this.total);
            delta = delta + increment;
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'accumulate');
    // 4001 measured once the hardened slot scans became one classifying pass per side.
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(4_100);
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments).toHaveLength(2);
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
  });

  it('respects a local update before the state recurrence', () => {
    const handler = handlerFor(`delta = delta + increment;
      this.total = this.total + delta;`);
    expect(handler).toMatchObject({ eligible: true });
  });

  it('retains direct source-counter prefixes after normalizing to rank', () => {
    const artifact = compileString(`event Phase(bigint value);
      contract C() {
        bigint total;
        function accumulate(int limit) public {
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            emit Phase(this.total);
            this.total = this.total + cursor;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'accumulate');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.runtimeLoopEvents?.[0].arguments?.[0])
      .not.toEqual(handler?.runtimeLoopEvents?.[0].arguments?.[1]);
  });

  it('replays bounded checked arithmetic without polynomial regrouping', () => {
    const artifact = compileString(`event Phase(int value);
      contract C() {
        int total;
        function accumulate(int limit, int initialDelta, int increment) public {
          int delta = initialDelta;
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.total = this.total + delta;
            delta = delta + increment;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject({ eligible: true });
  }, 120_000);

  it.each([
    ['this.other', true],
    ['this.source[0]', false],
  ] as const)('classifies a %s initializer by authenticated scalar shape', (initializer, eligible) => {
    const artifact = compileString(`event Phase(bigint value);
      contract C() {
        bigint total;
        bigint other;
        mapping(int => bigint) source;
        function accumulate(int limit, bigint increment) public {
          bigint delta = ${initializer};
          for (int cursor = 1; cursor < limit; cursor = cursor + 2) {
            this.total = this.total + delta;
            delta = delta + increment;
            emit Phase(this.total);
          }
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'accumulate'))
      .toMatchObject(eligible ? { eligible: true }
        : { eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it.each([
    ['a resource-dependent update', `delta = delta + this.source[cursor];
      this.total = this.total + delta;`],
    ['a coupled update', `delta = delta + coupled; coupled = coupled + 1;
      this.total = this.total + delta;`],
    ['two carried deltas', `this.total = this.total + delta + coupled;
      delta = delta + increment; coupled = coupled + increment;`],
    ['a conditional update', `if (flag) { delta = delta + 1; } else { delta = delta + 2; }
      this.total = this.total + delta;`],
    ['a continue-crossed recurrence', `this.total = this.total + delta;
      delta = delta + increment; if (flag) { continue; }`],
    ['a break-crossed recurrence', `this.total = this.total + delta;
      delta = delta + increment; if (flag) { break; }`],
  ])('keeps %s fenced', (_label, body) => {
    expect(handlerFor(body)).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('replays an effect-dependent update while preserving helper effects', () => {
    expect(handlerFor(`delta = delta + derive(cursor);
      this.total = this.total + delta;`)).toMatchObject({ eligible: true });
  });

  it.each([
    ['an authenticated scalar-state update', `delta = delta + this.other;
      this.total = this.total + delta;`],
    ['a truncating update', `delta = delta + increment / 2;
      this.total = this.total + delta;`],
  ])('exactly replays %s', (_label, body) => {
    expect(handlerFor(body)).toMatchObject({ eligible: true });
  });
});
