import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { provisionalInvocationResult } from '../../src/stateful/child-deployment-recipes.js';

const artifact = {
  contractName: 'NativeCompositeResult', constructorInputs: [], abi: [], bytecode: '', source: '',
  structs: [{
    name: 'Rec',
    fields: [
      { name: 'value', type: 'uint256' },
      { name: 'note', type: 'bytes' },
      { name: 'flags', type: 'bool[2]' },
    ],
  }],
} as unknown as Artifact;

describe('native composite message-bus result canonicalization', () => {
  it('creates a type-correct provisional value for a dynamic array of structs', () => {
    expect(provisionalInvocationResult(artifact, ['Rec[]'])).toBe('00');
  });
});
