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
  function fill(int[] memory keys, int base, int limit, int stride) internal pure {
    ${loop}
  }
  function write(int count, int base, int limit, int stride) public {
    int[] memory keys = new int[](count);
    fill(keys, base, limit, stride);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(true);
  }
}`, KERNEL);

const operators = (candidate: unknown): string[] => {
  const result: string[] = [];
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.operator === 'string') result.push(record.operator);
    for (const child of Object.values(record)) collect(child);
  };
  collect(candidate);
  return result;
};

describe('pre-test constructed mapping-key domains', () => {
  it.each([
    ['source while', `int cursor = 0;
      while (cursor < limit) { keys[cursor] = base + cursor; cursor = cursor + 2; }`],
    ['normalized for', `for (int cursor = 0; cursor < limit; cursor = cursor + 2) {
      keys[cursor] = base + cursor;
    }`],
    ['non-zero source while', `int cursor = 3;
      while (cursor < limit) { keys[cursor] = base + cursor; cursor = cursor + 2; }`],
    ['non-zero normalized for', `for (int cursor = 3; cursor < limit; cursor = cursor + 2) {
      keys[cursor] = base + cursor;
    }`],
    ['non-zero do-while', `int cursor = 3;
      do { keys[cursor] = base + cursor; cursor = cursor + 2; } while (cursor < limit);`],
  ])('publishes the exact sparse domain for a canonical %s', (label, loop) => {
    const artifact = compile(loop);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'write')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(operators(expression)).toEqual(expect.arrayContaining(['>=', '<', '%', '==', '&&', '-']));
    if (label.includes('do-while')) expect(operators(expression)).toContain('||');
    else expect(operators(expression)).not.toContain('||');
    if (label.startsWith('non-zero')) expect(JSON.stringify(expression)).toContain('"value":"3"');
  });

  it.each([
    ['runtime-selected stride', `int cursor = 0;
      while (cursor < limit) { keys[cursor] = base + cursor; cursor = cursor + stride; }`],
    ['mutated stride', `int cursor = 0;
      int step = 2;
      while (cursor < limit) { keys[cursor] = base + cursor; step = step + 1; cursor = cursor + step; }`],
    ['negative start', `int cursor = -1;
      while (cursor < limit) { keys[cursor] = base + cursor; cursor = cursor + 2; }`],
    ['negative post-test start', `int cursor = -1;
      do { keys[cursor] = base + cursor; cursor = cursor + 2; } while (cursor < limit);`],
  ])('keeps a %s fenced', (_label, loop) => {
    const artifact = compile(loop);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
