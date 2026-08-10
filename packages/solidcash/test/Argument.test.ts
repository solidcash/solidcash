import { describe, it, expect } from 'vitest';
import { encodeInt } from '@solidcash/utils';
import { encodeFunctionArgument } from '../src/index.js';

describe('encodeFunctionArgument: empty arrays', () => {
  it('preserves the zero count prefix through the outer unlocking-script push', () => {
    expect(encodeFunctionArgument([], 'address[]')).toEqual(Uint8Array.from([0x01, 0x00]));
  });
});

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

// SDK encoding of function-pointer arguments. A function value is the target's integer functionId,
// so it encodes as int even though the ABI type string is `function(...)returns(...)`.
describe('encodeFunctionArgument: function pointer types', () => {
  it('encodes a function pointer (functionId) as int', () => {
    expect(encodeFunctionArgument(0n, 'function(int)returns(int)')).toEqual(encodeInt(0n));
    expect(encodeFunctionArgument(3n, 'function(bytes)returns(bool)')).toEqual(encodeInt(3n));
    expect(encodeFunctionArgument(2n, 'function()')).toEqual(encodeInt(2n));
  });

  it('rejects a non-bigint function pointer value', () => {
    expect(() => encodeFunctionArgument('double' as unknown as bigint, 'function(int)returns(int)')).toThrow();
  });
});

// Hardhat/MistSwap suites pass ethers-v5 BigNumber (or the testing-package shim) into constructor
// args via getBigNumber(). Without coercion, encode throws "Found type 'object' where type 'uint256'".
describe('encodeFunctionArgument: ethers BigNumber / numeric objects', () => {
  it('coerces an object with toBigInt() (testing BigNumber shim)', () => {
    const bn = { _value: 1_000_000_000_000_000_000n, toBigInt: () => 1_000_000_000_000_000_000n };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'uint256')).toEqual(
      encodeInt(1_000_000_000_000_000_000n),
    );
  });

  it('coerces an ethers-v5-shaped BigNumber ({_hex,_isBigNumber})', () => {
    const bn = { _hex: '0x64', _isBigNumber: true, toString: () => '100' };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'uint256')).toEqual(encodeInt(100n));
  });

  it('coerces a BN.js-like object via toString(10)', () => {
    const bn = { toString: (base?: number) => (base === 10 || base === undefined ? '42' : '2a') };
    expect(encodeFunctionArgument(bn as unknown as bigint, 'int')).toEqual(encodeInt(42n));
  });

  it('still rejects a plain non-numeric object', () => {
    expect(() => encodeFunctionArgument({ foo: 1 } as unknown as bigint, 'uint256')).toThrow(/object/);
  });
});
