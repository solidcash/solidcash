// abi.decode EVM byte-parity (evmCompat), value types. Each case round-trips abi.decode(abi.encode(a), (T)) == a
// on both sides; since abi.encode is proven EVM-identical, a correct round-trip proves decode is its exact inverse.
import { describe, it } from 'vitest';
import {
  assertBothAccept, decodeCase, decodeMultiCase, assertBchDecode, bchDecodeCase, bchArrayDecodeCase,
} from './harness.js';

const hbb = (h: string): Uint8Array => Uint8Array.from((h.slice(2).match(/../g) ?? []).map((b) => parseInt(b, 16)));

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

describe('abi.decode (evmCompat): dynamic bytes/string (head-offset random access)', () => {
  const d = (types: string[], values: unknown[]): Promise<void> => assertBchDecode(bchDecodeCase({ types, values }));
  it('single bytes (short)', () => d(['bytes'], ['0xdeadbeef']));
  it('single bytes (empty)', () => d(['bytes'], ['0x']));
  it('single bytes (33 bytes, crosses pad)', () => d(['bytes'], [`0x${'cd'.repeat(33)}`]));
  it('single bytes (64 bytes, two words)', () => d(['bytes'], [`0x${'11'.repeat(64)}`]));
  it('single string', () => d(['string'], ['hello world']));
  it('single string (empty)', () => d(['string'], ['']));
  it('uint then bytes', () => d(['uint', 'bytes'], [42n, '0xcafe']));
  it('bytes then uint (dynamic first)', () => d(['bytes', 'uint'], ['0xaabbcc', 5n]));
  it('string then bytes (two dynamics)', () => d(['string', 'bytes'], ['gm', '0xbeef']));
  it('bytes then string (two dynamics)', () => d(['bytes', 'string'], ['0xff', 'the quick brown fox']));
  it('uint, bytes, string (mixed)', () => d(['uint', 'bytes', 'string'], [7n, '0x1234', 'zzz']));
  it('bytes, uint, string (dynamic interleaved with static)', () => d(['bytes', 'uint', 'string'], ['0xaa', 99n, 'mid']));
  it('uint160 + bytes (transfer-with-data shape)', () => d(['uint160', 'bytes'], [0x1122334455n, '0xdeadbeef']));
});

describe('abi.decode (evmCompat): dynamic arrays of value types', () => {
  const arr = (elemType: string, values: unknown[]): Promise<void> =>
    assertBchDecode(bchArrayDecodeCase({ elemType, values }));
  it('uint256[] three elements', () => arr('uint256', [1n, 2n, 3n]));
  it('uint256[] single', () => arr('uint256', [42n]));
  it('uint256[] empty', () => arr('uint256', []));
  it('uint256[] large (max, 2^255-1)', () => arr('uint256', [MAX, (1n << 255n) - 1n, 0n]));
  it('int256[] mixed sign', () => arr('int256', [-1n, 5n, -100n]));
  it('int128[] negatives', () => arr('int128', [-1n, -(1n << 100n), 7n]));
  it('bytes32[]', () => arr('bytes32', [hbb(`0x${'ab'.repeat(32)}`), hbb(`0x${'cd'.repeat(32)}`)]));
  it('bool[]', () => arr('bool', [true, false, true]));
});
