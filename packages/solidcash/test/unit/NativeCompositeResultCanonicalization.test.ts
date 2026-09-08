import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { provisionalInvocationResult } from '../../src/message-bus/compose.js';
import { encodeMessageBusArguments } from '../../src/message-bus/message-bus.js';

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

  it('removes only the empty dynamic-array argument transport escape from inline row data', () => {
    const transport = encodeFunctionArgument([], 'Rec[]', artifact.structs) as Uint8Array;
    expect(transport).toEqual(Uint8Array.of(0x01, 0x00));
    expect(encodeMessageBusArguments([transport], ['Rec[]'], artifact.structs))
      .toEqual(Uint8Array.of(0x00));

    const nonempty = encodeFunctionArgument([{
      value: 3n, note: Uint8Array.of(0xaa), flags: [true, false],
    }], 'Rec[]', artifact.structs) as Uint8Array;
    expect(encodeMessageBusArguments([nonempty], ['Rec[]'], artifact.structs)).toEqual(nonempty);
  });
});
