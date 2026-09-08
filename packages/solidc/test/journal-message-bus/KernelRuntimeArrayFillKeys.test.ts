import { compileString } from '../../src/compiler.js';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel runtime-sized constructed-key initialization', () => {
  it('derives the exact key recipe for a canonical full-array helper fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base) internal pure {
        for (int cursor = 0; cursor < keys.length; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base) public {
        int[] memory keys = new int[](count);
        fill(keys, base);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 10;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const loop = artifact.abi.find((entry) => entry.name === 'apply')?.sortedUpsertLoopInfo?.[0];
    expect(loop).toMatchObject({
      collection: 'records',
      varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      varyingKeyExpressions: [expect.objectContaining({ kind: 'ternary' })],
    });
  });

  it.each([
    ['an exact one-trailing-hole domain', 'cursor < keys.length - 1'],
  ])('derives the exact key recipe for %s', (_label, loopHeader) => {
    const header = loopHeader.includes(';')
      ? `for (int cursor = 0; ${loopHeader})`
      : `for (int cursor = 0; ${loopHeader}; cursor = cursor + 1)`;
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int limit) internal pure {
        ${header} { keys[cursor] = cursor + 20; }
      }
      function apply(int count, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'literal', value: '0' },
    });
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('<');
    expect(operators).not.toContain('%');
  });

  it('derives a conditional key recipe for a canonical public partial bound', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifFalse: { kind: 'literal', value: '0' },
    });
    const operators: string[] = [];
    const collectOperators = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (typeof record.operator === 'string') operators.push(record.operator);
      for (const value of Object.values(record)) collectOperators(value);
    };
    collectOperators(expression);
    expect(operators).toContain('<');
  });

  it('preserves source-order last-write semantics in a partial fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < limit; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
          keys[cursor] = base + cursor + 100;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: true });
    const expression = artifact.abi.find((entry) => entry.name === 'apply')
      ?.sortedUpsertLoopInfo?.[0]?.varyingKeyExpressions?.[0];
    expect(expression).toMatchObject({
      kind: 'ternary',
      ifTrue: {
        kind: 'binary', operator: '+', right: { kind: 'literal', value: '100' },
      },
    });
    const literalValues: string[] = [];
    const collectLiterals = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const record = candidate as Record<string, unknown>;
      if (record.kind === 'literal' && typeof record.value === 'string') literalValues.push(record.value);
      for (const value of Object.values(record)) collectLiterals(value);
    };
    collectLiterals(expression);
    expect(literalValues).toContain('100');
  });

  it('does not infer a replayable public bound from a pure helper call', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function identity(int value) internal pure returns (int) { return value; }
      function fill(int[] memory keys, int base, int limit) internal pure {
        for (int cursor = 0; cursor < identity(limit); cursor = cursor + 1) {
          keys[cursor] = base + cursor;
        }
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it('does not approximate the final counter after a possibly empty partial fill', () => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, int base, int limit) internal pure {
        int cursor = 0;
        while (cursor < limit) {
          keys[cursor] = base + cursor;
          cursor = cursor + 1;
        }
        keys[0] = cursor;
      }
      function apply(int count, int base, int limit) public {
        int[] memory keys = new int[](count);
        fill(keys, base, limit);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });

  it.each([
    ['an offset write index', 'int step', 'cursor < keys.length', 'cursor = cursor + 1',
      'keys[cursor + 1] = cursor + 20;'],
    ['a runtime stride', 'int step', 'cursor < keys.length', 'cursor = cursor + step',
      'keys[cursor] = cursor + 20;'],
    ['a literal stride', 'int step', 'cursor < keys.length', 'cursor = cursor + 2',
      'keys[cursor] = cursor + 20;'],
    ['a mutated runtime bound', 'int limit', 'cursor < limit', 'cursor = cursor + 1',
      'keys[cursor] = cursor + 20; limit = limit - 1;'],
  ])('keeps %s fenced when the exact written index set is unavailable', (
    _label, helperParameter, condition, update, body,
  ) => {
    const artifact = compileString(`contract Registry() {
      mapping(int => int) records;
      function fill(int[] memory keys, ${helperParameter}) internal pure {
        for (int cursor = 0; ${condition}; ${update}) { ${body} }
      }
      function apply(int count, int boundary) public {
        int[] memory keys = new int[](count);
        fill(keys, boundary);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor;
        }
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
  });
});
