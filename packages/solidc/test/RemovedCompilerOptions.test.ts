import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti, compileStringSplit } from '../src/index.js';

const SOURCE = 'contract C() { function f(int x) { require(x == 1); } }';
const compileWith = (options: Record<string, unknown>): unknown => compileString(SOURCE, options as never);

describe('options removed with the message bus', () => {
  it.each([
    ['messageBus', true],
    ['messageBus', false],
    ['messageBus', undefined],
    ['messageBusKernel', true],
    ['messageBusGraphContext', true],
    ['messageBusEntryPoolCapacity', 4],
    ['ownerAltAnchor', true],
    ['handlerBandModel', false],
  ])("refuses '%s: %s' by name whatever its value", (key, value) => {
    expect(() => compileWith({ [key]: value }))
      .toThrow(new RegExp(`solidc \\[REMOVED_COMPILER_OPTION\\]: the option '${key}' was removed`));
  });

  it('names every removed option in one refusal', () => {
    expect(() => compileWith({ messageBus: true, messageBusKernel: true }))
      .toThrow(/the options 'messageBus', 'messageBusKernel' were removed with the message bus/);
  });

  it('refuses them on the multi-contract and split entry points', () => {
    expect(() => compileStringMulti(SOURCE, { messageBus: true } as never)).toThrow(/REMOVED_COMPILER_OPTION/);
    expect(() => compileStringSplit(SOURCE, { split: 'size', messageBus: false } as never))
      .toThrow(/REMOVED_COMPILER_OPTION/);
  });

  it('compiles once they are gone', () => {
    expect(compileString(SOURCE, {}).contractName).toBe('C');
  });
});
