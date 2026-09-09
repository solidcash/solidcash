import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const compile = (
  fixedKey: string, recursiveScope = 'scope',
): ReturnType<typeof compileString> => compileString(`contract Register() {
  mapping(int => mapping(int => int)) source;
  mapping(int => int) result;
  function copy(int remaining, int scope) public returns (int) {
    if (remaining == 0) return 0;
    int terminal = copy(remaining - 1, ${recursiveScope});
    this.result[remaining] = this.source[remaining][${fixedKey}] + terminal;
    return terminal;
  }
}`, KERNEL);

describe('recursive mapping derived invariant tuple keys', () => {
  it.each([
    ['arithmetic', 'scope + 1'],
    ['cast', 'int(uint32(scope))'],
    ['conditional', 'scope >= 0 ? scope + 1 : 0'],
  ])('publishes a %s invariant-key recipe but fences its read/write settlement', (_label, fixedKey) => {
    const artifact = compile(fixedKey);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    const stream = artifact.abi.find((entry) => entry.name === 'copy')?.sortedUpsertLoopInfo
      ?.find((candidate) => candidate.collection === 'source');
    expect(stream).toMatchObject({ op: 'read', varyingKeyIndices: [0] });
    expect(stream?.varyingKeyExpressions).toHaveLength(2);
  });

  it('keeps a component derived from a changing recursive parameter fenced', () => {
    const artifact = compile('scope + 1', 'scope + 1');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((entry) => entry.name === 'copy')?.recursiveStateHandler).toBe(true);
  });
});
