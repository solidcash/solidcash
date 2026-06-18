import { describe, it, expect } from 'vitest';
import { encodeInt } from '@solidcash/utils';
import { encodeFunctionArgument } from '../src/index.js';

// SDK encoding of enum-typed arguments. Enums are int-backed; an enum value (bigint) encodes as int
// even though the ABI type is the enum name (which is not a recognized primitive type string).
describe('encodeFunctionArgument: enum types', () => {
  it('encodes an int-backed enum value as int', () => {
    expect(encodeFunctionArgument(1n, 'Color')).toEqual(encodeInt(1n));
    expect(encodeFunctionArgument(100n, 'Status')).toEqual(encodeInt(100n));
  });

  it('rejects a non-bigint value for an enum type', () => {
    expect(() => encodeFunctionArgument('green', 'Color')).toThrow(/Unrecognized type/);
  });

  it('still rejects a genuinely unknown type with a non-int value', () => {
    expect(() => encodeFunctionArgument(true as unknown as bigint, 'NotAType')).toThrow(/Unrecognized type/);
  });
});
