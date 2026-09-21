import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
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

  it('uses an authenticated read-only scalar state helper bound', () => {
    const attemptFailureBox = { failures: [] };
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
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: attemptFailureBox,
    });
    expect(attemptFailureBox.failures).toEqual([]);
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('keeps a helper bound fenced when its state source is mutable in the handler closure', () => {
    const artifact = compileString(`contract C() {
      int limit;
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int next) public {
        this.limit = next;
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

  it('uses the type-level length of a fixed local array as an exact helper bound', () => {
    const attemptFailureBox = { failures: [] };
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base) public {
        int[3] memory domain;
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: attemptFailureBox,
    });
    expect(attemptFailureBox.failures).toEqual([]);
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
  });

  it('uses the captured length of an unresized runtime allocation as an exact bound', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit) public {
        int[] memory domain = new int[](runtimeLimit);
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it('replays the final length of a finite straight-line resize schedule', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit) public {
        int[] memory domain = new int[](runtimeLimit);
        domain.push(base);
        domain.push(base + 1);
        domain.pop();
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it('joins two exhaustive finite resize schedules into one exact length', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit, bool choose) public {
        int[] memory domain = new int[](runtimeLimit);
        if (choose) {
          domain.push(base + 10);
        } else {
          domain.push(base + 20);
          domain.push(base + 21);
        }
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['a non-exhaustive arm', 'if (choose) { domain.push(base); }'],
    ['a one-sided schedule', `if (choose) { domain.push(base); }
      else { domain[0] = base + 1; }`],
    ['a nested runtime-selected schedule', `if (choose) {
      if (runtimeLimit > 0) { domain.push(base); }
    } else { domain.push(base + 1); }`],
    ['an escaping arm', `if (choose) { touch(domain, base); }
      else { domain.push(base + 1); }`],
  ])('keeps an exhaustive resize join with %s fenced', (_label, branch) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function touch(int[] memory domain, int value) internal { domain[0] = value; }
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit, bool choose) public {
        int[] memory domain = new int[](runtimeLimit);
        ${branch}
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('joins exhaustive literal switch resize schedules in first-match order', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit, int mode) public {
        int[] memory domain = new int[](runtimeLimit);
        switch (mode) {
          case 0: domain.push(base + 10); break;
          case 1: domain.push(base + 20); domain.push(base + 21); break;
          default: domain.push(base + 30); domain.push(base + 31); domain.pop();
        }
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['fallthrough', `case 0: domain.push(base);
      case 1: domain.push(base + 1); break;
      default: domain.push(base + 2);`],
    ['no default', `case 0: domain.push(base); break;
      case 1: domain.push(base + 1); break;`],
    ['a nested selected resize', `case 0:
        if (runtimeLimit > 0) { domain.push(base); }
        break;
      case 1: domain.push(base + 1); break;
      default: domain.push(base + 2);`],
    ['an escaping arm', `case 0: touch(domain, base); break;
      case 1: domain.push(base + 1); break;
      default: domain.push(base + 2);`],
  ])('keeps a literal resize switch with %s fenced', (_label, cases) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function touch(int[] memory domain, int value) internal { domain[0] = value; }
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit, int mode) public {
        int[] memory domain = new int[](runtimeLimit);
        switch (mode) { ${cases} }
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('replays an exact fixed-count source-loop resize schedule', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit) public {
        int[] memory domain = new int[](runtimeLimit);
        for (int round = 0; round < 3; round = round + 1) {
          domain.push(base + round);
          domain.push(base + 10 + round);
          domain.pop();
        }
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, {
      ...KERNEL,
      __artifactCache: false,
      __strictNoInternalRecovery: true,
      __attemptFailureBox: { failures },
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    expect(bytecodeToAsm(Buffer.from(artifact.functionBodies!['53434231'], 'hex')))
      .toContain('OP_INVOKE');
  });

  it.each([
    ['a dynamic bound', 'for (int round = 0; round < rounds; round = round + 1) { domain.push(base + round); }'],
    ['a selected break', `for (int round = 0; round < 3; round = round + 1) {
      if (round == rounds) { break; }
      domain.push(base + round);
    }`],
    ['a selected continue', `for (int round = 0; round < 3; round = round + 1) {
      if (round == rounds) { continue; }
      domain.push(base + round);
    }`],
    ['a nested selected resize', `for (int round = 0; round < 3; round = round + 1) {
      if (round == rounds) { domain.push(base + round); }
    }`],
    ['a selected element mutation', `for (int round = 0; round < 3; round = round + 1) {
      domain.push(base + round);
      if (round == rounds) { domain[round] = base + 10; }
    }`],
    ['an escape', `for (int round = 0; round < 3; round = round + 1) {
      touch(domain, base + round);
      domain.push(base + round);
    }`],
  ])('keeps a fixed resize loop with %s fenced', (_label, schedule) => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      function touch(int[] memory domain, int value) internal { domain[0] = value; }
      function fill(int[] memory keys, int base, int stop) internal pure {
        for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function write(int count, int base, int runtimeLimit, int rounds) public {
        int[] memory domain = new int[](runtimeLimit);
        ${schedule}
        int[] memory keys = new int[](count);
        fill(keys, base, domain.length);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.slots[keys[cursor]] = cursor + 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it.each([
    ['a runtime-selected resize', 'if (runtimeLimit > 0) { domain.push(base); }'],
    ['an escaped allocation', 'touch(domain, base);'],
    ['a helper-owned resize', 'resize(domain, base);'],
    ['a reassigned allocation', 'domain = new int[](base);'],
  ])('keeps %s out of an allocation-length recipe', (_label, operation) => {
      const handler = compile(`
        function touch(int[] memory domain, int value) internal { domain[0] = value; }
        function resize(int[] memory domain, int value) internal pure { domain.push(value); }
        function fill(int[] memory keys, int base, int stop) internal pure {
          for (int cursor = 0; cursor < stop; cursor = cursor + 1) {
            keys[cursor] = base + cursor;
          }
        }
      `, `
        int[] memory domain = new int[](runtimeLimit);
        ${operation}
        fill(keys, base, domain.length);
      `);
      expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
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
