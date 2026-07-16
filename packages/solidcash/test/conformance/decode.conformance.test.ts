// abi.decode EVM byte-parity (evmCompat), value types. Each case round-trips abi.decode(abi.encode(a), (T)) == a
// on both sides; since abi.encode is proven EVM-identical, a correct round-trip proves decode is its exact inverse.
import { describe, it } from 'vitest';
import { assertBothAccept, decodeCase, decodeMultiCase } from './harness.js';

const MAX = (1n << 256n) - 1n;
const INT_MIN = -(1n << 255n);
const INT_MAX = (1n << 255n) - 1n;

const dec = (type: string, value: unknown): Promise<void> => assertBothAccept(decodeCase({ type, value }));

describe('abi.decode (evmCompat): unsigned integers', () => {
  it('uint256 small', () => dec('uint', 42n));
  it('uint256 zero', () => dec('uint', 0n));
  it('uint256 max (33-byte boundary)', () => dec('uint', MAX));
  it('uint256 = 2^255 (high bit set)', () => dec('uint', 1n << 255n));
  it('uint256 = 2^255 - 1', () => dec('uint', (1n << 255n) - 1n));
  it('uint8 max', () => dec('uint8', 0xffn));
  it('uint64 max', () => dec('uint64', (1n << 64n) - 1n));
  it('uint128', () => dec('uint128', (1n << 128n) - 1n));
  it('uint160 (address-shaped)', () => dec('uint160', 0x00112233445566778899aabbccddeeff00112233n));
});

describe('abi.decode (evmCompat): signed integers (twos-complement)', () => {
  it('int positive', () => dec('int', 12345n));
  it('int -1', () => dec('int', -1n));
  it('int negative', () => dec('int', -12345n));
  it('int256 min', () => dec('int', INT_MIN));
  it('int256 max', () => dec('int', INT_MAX));
  it('int8 = -1', () => dec('int8', -1n));
  it('int8 = -128', () => dec('int8', -128n));
  it('int128 negative', () => dec('int128', -(1n << 100n)));
});

describe('abi.decode (evmCompat): bytesN + bool', () => {
  it('bytes32', () => dec('bytes32', `0x${'ab'.repeat(32)}`));
  it('bytes4', () => dec('bytes4', '0xdeadbeef'));
  it('bytes1', () => dec('bytes1', '0xff'));
  it('bytes20', () => dec('bytes20', `0x${'11'.repeat(20)}`));
  it('bool true', () => dec('bool', true));
  it('bool false', () => dec('bool', false));
});

describe('abi.decode (evmCompat): multiple value types (N-word head)', () => {
  const m = (types: string[], names: string[], values: unknown[]): Promise<void> =>
    assertBothAccept(decodeMultiCase({ types, names, values }));
  it('(uint, uint)', () => m(['uint', 'uint'], ['a', 'b'], [1n, 2n]));
  it('(uint, bool)', () => m(['uint', 'bool'], ['a', 'b'], [42n, true]));
  it('(uint160, uint256, bytes4)', () => m(['uint160', 'uint256', 'bytes4'], ['a', 'b', 'c'], [0x1234n, 999n, '0xdeadbeef']));
  it('(int, int) mixed sign', () => m(['int', 'int'], ['a', 'b'], [-5n, 7n]));
  it('(bytes32, uint, bool)', () => m(['bytes32', 'uint', 'bool'], ['a', 'b', 'c'], [`0x${'11'.repeat(32)}`, 1n, false]));
  it('(uint256 max, int256 min)', () => m(['uint', 'int'], ['a', 'b'], [MAX, INT_MIN]));
});
