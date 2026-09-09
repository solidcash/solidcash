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

const compile = (helper: string, call: string): Handler | undefined => compileString(`contract C() {
  mapping(int => int) slots;
  ${helper}
  function write(int count, int base, int runtimeLimit) public {
    int[] memory keys = new int[](count);
    ${call}
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(count == 3);
  }
}`, KERNEL).messageBus?.handlers.find((handler) => handler.name === 'write');

describe('constructed-array exhausted finite helper replay', () => {
  it('exhausts helper-formal bounds and steps resolved from literal call arguments', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit, int step) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + step) {
          keys[cursor / step] = base + cursor;
        }
      }
    `, 'fill(keys, base, 3 * 2, 1 + 1);');
    expect(handler).toMatchObject({ eligible: true });
  });

  it('replays a canonical partial fill over a public runtime helper bound', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
    `, 'fill(keys, base, runtimeLimit);');
    expect(handler).toMatchObject({ eligible: true });
  });

  it.each([
    ['for', `for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
      keys[cursor] = base + cursor;
    }`],
    ['while', `int cursor = 0;
    while (cursor < limit) {
      keys[cursor] = base + cursor;
      cursor = cursor + 1;
    }`],
    ['do-while', `int cursor = 0;
    do {
      keys[cursor] = base + cursor;
      cursor = cursor + 1;
    } while (cursor < limit);`],
  ])('keeps a replay-expanded runtime remainder behind the layout fence in a %s helper', (_kind, loop) => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        ${loop}
      }
    `, 'fill(keys, base, runtimeLimit % 4);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('keeps a runtime remainder range beyond the shared expansion budget fenced', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
    `, 'fill(keys, base, runtimeLimit % 258);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('exhausts a finite runtime-remainder helper through its first replayable break', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          if (cursor == 1) { break; }
          keys[cursor] = base + cursor;
        }
      }
    `, 'fill(keys, base, runtimeLimit % 4);');
    expect(handler).toMatchObject({ eligible: true });
  });

  it('keeps an opaque state-derived helper break fenced', () => {
    const artifact = compileString(`contract C() {
      bool stopped;
      mapping(int => int) slots;
      function shouldStop(int cursor) internal returns (bool) {
        return this.stopped && cursor > 0;
      }
      function fill(int[] memory keys, int base, int limit) internal {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          if (shouldStop(cursor)) { break; }
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, runtimeLimit % 4);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(count == 3);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps nested runtime-loop break provenance fenced', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          for (int inner = 0; inner < limit; inner = inner + 1) {
            if (inner == cursor) { break; }
          }
          keys[cursor] = base + cursor;
        }
      }
    `, 'fill(keys, base, runtimeLimit % 4);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a helper which mutates its resolved bound fenced', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
          limit = limit + 1;
        }
      }
    `, 'fill(keys, base, 3);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('keeps a state-derived helper bound fenced', () => {
    const artifact = compileString(`contract C() {
      int limit;
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base) public {
        int[] memory keys = new int[](count);
        fill(keys, base, this.limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('exhausts a bounded-integer recursive helper with an invariant runtime scalar', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        if (limit > 0) { fill(keys, base, limit - 1); }
        keys[limit] = base + limit;
      }
    `, 'fill(keys, base, 2);');
    expect(handler).toMatchObject({ eligible: true });
  });

  it('keeps a mutually cyclic finite-helper recipe fenced', () => {
    const handler = compile(`
      function fillA(int[] memory keys, int base, int limit) internal pure {
        if (limit > 0) { fillB(keys, base, limit - 1); }
        keys[limit] = base + limit;
      }
      function fillB(int[] memory keys, int base, int limit) internal pure {
        if (limit > 0) { fillA(keys, base, limit - 1); }
        keys[limit] = base + limit;
      }
    `, 'fillA(keys, base, 2);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('does not increase the shared 256-iteration expansion budget', () => {
    const handler = compile(`
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
    `, 'fill(keys, base, 257);');
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
