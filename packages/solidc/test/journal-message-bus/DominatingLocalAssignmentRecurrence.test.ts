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

const handler = (prefix: string, state = ''): Handler | undefined => {
  const artifact = compileString(`event Seen(int value);
  contract C() {
    int stored;
    mapping(int => int) source;
    ${state}
    function derive(int value) internal returns (int) { emit Seen(value); return value; }
    function apply(int limit, int seed, bool select) public {
      int next = 0;
      ${prefix}
      for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
        emit Seen(next);
        next = cursor + 10;
      }
      require(limit >= 0 && limit <= 64);
    }
  }`, KERNEL);
  return artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply');
};

describe('dominating local assignment recurrence', () => {
  it('uses the last unconditional pure assignment before the loop', () => {
    const admitted = handler('next = seed; next = seed + 2;');
    expect(admitted).toMatchObject({ eligible: true });
    expect(JSON.stringify(admitted?.runtimeLoopEvents)).toContain('"paramIndex":1');
    expect(JSON.stringify(admitted?.runtimeLoopEvents)).toContain('"value":"2"');
  });

  it('accepts an authenticated scalar-state value', () => {
    expect(handler('next = this.saved;', 'int saved;')).toMatchObject({ eligible: true });
  });

  it.each([
    ['branch-selected definition', 'if (select) next = seed;'],
    ['effectful definition', 'next = derive(seed);'],
    ['mutable alias', 'int alias = seed; next = alias; alias = alias + 1;'],
    ['collection-derived definition', 'next = this.source[0];'],
  ])('keeps a %s fenced', (_label, prefix) => {
    expect(handler(prefix)).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
