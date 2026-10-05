import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const compile = (loop: string): ReturnType<typeof compileString> => compileString(`contract C() {
  mapping(int => int) slots;
  function fill(int[] memory keys, int base, int limit, int step) internal pure {
    int cursor = 0;
    ${loop}
  }
  function write(int count, int base, int limit, int step) public {
    int[] memory keys = new int[](count);
    fill(keys, base, limit, step);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(true);
  }
}`, KERNEL);

describe('post-test constructed mapping-key domains', () => {
  it('publishes the exact first-or-public-prefix domain', () => {
    const artifact = compile(`do {
      keys[cursor] = base + cursor;
      cursor = cursor + 1;
    } while (cursor < limit);`);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'write')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({ kind: 'ternary' });
    const operators: string[] = [];
    const collect = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collect(value);
    };
    collect(expression);
    expect(operators).toContain('>');
    expect(operators).toContain('<');
  });

  it('publishes the exact sparse domain of a positive literal progression', () => {
    const artifact = compile(`do {
      keys[cursor] = base + cursor;
      cursor = cursor + 2;
    } while (cursor < limit);`);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'write')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    const operators: string[] = [];
    const collect = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collect(value);
    };
    collect(expression);
    expect(operators).toContain('%');
    expect(operators).toContain('||');
    expect(operators).toContain('-');
  });

  it('keeps a runtime-selected post-test progression fenced', () => {
    const artifact = compile(`do {
      keys[cursor] = base + cursor;
      cursor = cursor + step;
    } while (cursor < limit);`);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
