// abi.encode EVM byte-parity (evmCompat). The Solidity side returns abi.encode(...) as bytes; the BCH side
// under evmCompat must produce byte-identical output. Phase 1: static value types (32-byte words).
import { describe, it } from 'vitest';
import { assertEncodeConformant, abiCase, selCase } from './harness.js';

const MAX = (1n << 256n) - 1n;
const INT_MIN = -(1n << 255n);

const enc = (params: string, encodeArgs: string, args: readonly unknown[]): Promise<void> =>
  assertEncodeConformant(abiCase({ params, encodeArgs, args }));

const pack = (params: string, encodeArgs: string, args: readonly unknown[]): Promise<void> =>
  assertEncodeConformant(abiCase({ params, encodeArgs, args, packed: true }));

describe('abi.encode (evmCompat): static value types', () => {
  it('single uint256', () => enc('uint a', 'a', [42n]));
  it('uint256 max (33-byte boundary)', () => enc('uint a', 'a', [MAX]));
  it('uint256 = 2^255 (high bit set)', () => enc('uint a', 'a', [1n << 255n]));
  it('two uint256', () => enc('uint a, uint b', 'a, b', [1n, 2n]));
  it('three uint256', () => enc('uint a, uint b, uint c', 'a, b, c', [10n, 20n, 30n]));
  it('uint8 (left-padded to 32)', () => enc('uint8 a', 'a', [0xffn]));
  it('uint128', () => enc('uint128 a', 'a', [(1n << 128n) - 1n]));
  it('int256 negative (twos-complement)', () => enc('int a', 'a', [-1n]));
  it('int256 min', () => enc('int a', 'a', [INT_MIN]));
  it('int256 positive', () => enc('int a', 'a', [12345n]));
  it('int8 negative (sign-extended to 32)', () => enc('int8 a', 'a', [-1n]));
  it('int8 = -128', () => enc('int8 a', 'a', [-128n]));
  it('bool true', () => enc('bool a', 'a', [true]));
  it('bool false', () => enc('bool a', 'a', [false]));
  it('bytes4 (right-padded)', () => enc('bytes4 a', 'a', ['0xdeadbeef']));
  it('bytes1', () => enc('bytes1 a', 'a', ['0xff']));
  it('bytes32', () => enc('bytes32 a', 'a', [`0x${'ab'.repeat(32)}`]));
  it('mixed uint + bool + bytes4', () => enc('uint a, bool b, bytes4 c', 'a, b, c', [7n, true, '0x01020304']));
  it('mixed int + uint (negative)', () => enc('int a, uint b', 'a, b', [-5n, 5n]));
});

describe('abi.encodePacked (evmCompat): natural-width, no padding', () => {
  it('uint256', () => pack('uint a', 'a', [42n]));
  it('uint8 (1 byte)', () => pack('uint8 a', 'a', [0xffn]));
  it('uint16 (2 bytes)', () => pack('uint16 a', 'a', [0x1234n]));
  it('uint32', () => pack('uint32 a', 'a', [0xdeadbeefn]));
  it('int8 negative (1 byte twos-complement)', () => pack('int8 a', 'a', [-1n]));
  it('int16 negative', () => pack('int16 a', 'a', [-256n]));
  it('bool true (1 byte)', () => pack('bool a', 'a', [true]));
  it('bytes4 (4 bytes, no pad)', () => pack('bytes4 a', 'a', ['0xdeadbeef']));
  it('bytes32', () => pack('bytes32 a', 'a', [`0x${'ab'.repeat(32)}`]));
  it('uint8 + uint16 concatenated', () => pack('uint8 a, uint16 b', 'a, b', [0xffn, 0x1234n]));
  it('mixed uint16 + bool + bytes2', () => pack('uint16 a, bool b, bytes2 c', 'a, b, c', [0x1234n, true, '0xabcd']));
});

describe('abi.encode (evmCompat): dynamic bytes/string (single trailing)', () => {
  it('single bytes (short)', () => enc('bytes memory a', 'a', ['0xdeadbeef']));
  it('single bytes (empty)', () => enc('bytes memory a', 'a', ['0x']));
  it('single bytes (32 bytes exact)', () => enc('bytes memory a', 'a', [`0x${'ab'.repeat(32)}`]));
  it('single bytes (33 bytes, crosses pad)', () => enc('bytes memory a', 'a', [`0x${'cd'.repeat(33)}`]));
  it('single bytes (64 bytes, two words)', () => enc('bytes memory a', 'a', [`0x${'11'.repeat(64)}`]));
  it('single string (hello)', () => enc('string memory a', 'a', ['hello']));
  it('single string (empty)', () => enc('string memory a', 'a', ['']));
  it('uint + trailing bytes', () => enc('uint a, bytes memory b', 'a, b', [42n, '0xdeadbeef']));
  it('two uint + trailing string', () => enc('uint a, uint b, string memory c', 'a, b, c', [1n, 2n, 'world']));
  it('bytes4 + trailing bytes', () => enc('bytes4 a, bytes memory b', 'a, b', ['0x01020304', '0xaabbccdd']));
  it('address-shaped uint160 + trailing bytes', () => enc('uint160 a, bytes memory b', 'a, b', [0x1234567890n, '0xff']));
});

describe('abi.encodeWithSelector (evmCompat)', () => {
  const sel = (params: string, selArgs: string, args: readonly unknown[]): Promise<void> =>
    assertEncodeConformant(selCase({ params, selectorAndArgs: selArgs, args }));
  it('selector only (no args)', () => sel('bytes4 s', 's', ['0xaabbccdd']));
  it('selector + uint', () => sel('bytes4 s, uint a', 's, a', ['0xdeadbeef', 42n]));
  it('selector + two uint', () => sel('bytes4 s, uint a, uint b', 's, a, b', ['0x12345678', 1n, 2n]));
  it('selector + int + bool', () => sel('bytes4 s, int a, bool b', 's, a, b', ['0x11223344', -7n, true]));
  it('selector + uint + trailing bytes', () => sel('bytes4 s, uint a, bytes memory b', 's, a, b', ['0x11223344', 5n, '0xcafe']));
});

describe('abi.encode (evmCompat): single dynamic at any position', () => {
  it('bytes then uint (dynamic first)', () => enc('bytes memory a, uint b', 'a, b', ['0xaabbcc', 5n]));
  it('uint, bytes, uint (dynamic in the middle)', () => enc('uint a, bytes memory b, uint c', 'a, b, c', [1n, '0xdead', 2n]));
  it('string first', () => enc('string memory a, uint b', 'a, b', ['hi', 99n]));
});

describe('abi.encode (evmCompat): EVM-address (uint160) + real-world patterns', () => {
  const ADDR = 0x00112233445566778899aabbccddeeff00112233n; // a 20-byte address value
  it('uint160 address (20 bytes left-padded to 32)', () => enc('uint160 a', 'a', [ADDR]));
  it('ERC20 transfer args: (uint160 to, uint256 amount)', () => enc('uint160 to, uint256 amt', 'to, amt', [ADDR, 10n ** 18n]));
  it('hashing preimage: (bytes32, uint256)', () => enc('bytes32 a, uint256 b', 'a, b', [`0x${'11'.repeat(32)}`, 42n]));
  it('nested-ish: (uint160, uint160, uint256)', () => enc('uint160 a, uint160 b, uint256 c', 'a, b, c', [ADDR, 1n, 2n]));
  it('permit-shaped: (uint160 owner, uint160 spender, uint256 value, uint256 nonce, uint256 deadline)',
    () => enc('uint160 a, uint160 b, uint256 c, uint256 d, uint256 e', 'a, b, c, d, e', [ADDR, 1n, 2n, 3n, 4n]));
});

describe('abi.encodeWithSelector (evmCompat): real-world', () => {
  const sel = (params: string, selArgs: string, args: readonly unknown[]): Promise<void> =>
    assertEncodeConformant(selCase({ params, selectorAndArgs: selArgs, args }));
  const ADDR = 0x00112233445566778899aabbccddeeff00112233n;
  it('transfer(address,uint256) selector + args', () => sel('bytes4 s, uint160 to, uint256 amt', 's, to, amt', ['0xa9059cbb', ADDR, 100n]));
  it('approve(address,uint256)', () => sel('bytes4 s, uint160 sp, uint256 v', 's, sp, v', ['0x095ea7b3', ADDR, 10n ** 18n]));
});

describe('abi.encode (evmCompat): more widths + bytesN distinctions', () => {
  it('int128 negative', () => enc('int128 a', 'a', [-(1n << 100n)]));
  it('int64 negative', () => enc('int64 a', 'a', [-42n]));
  it('uint64 max', () => enc('uint64 a', 'a', [(1n << 64n) - 1n]));
  it('bytes8', () => enc('bytes8 a', 'a', ['0x0102030405060708']));
  it('bytes16', () => enc('bytes16 a', 'a', [`0x${'ab'.repeat(16)}`]));
  it('bytes20 right-padded (distinct from uint160 left-pad)', () => enc('bytes20 a', 'a', [`0x${'11'.repeat(20)}`]));
});

describe('abi.encodeWithSelector (evmCompat): ERC721 + query patterns', () => {
  const sel = (params: string, selArgs: string, args: readonly unknown[]): Promise<void> =>
    assertEncodeConformant(selCase({ params, selectorAndArgs: selArgs, args }));
  const ADDR = 0x00112233445566778899aabbccddeeff00112233n;
  it('transferFrom(address,address,uint256)', () => sel('bytes4 s, uint160 a, uint160 b, uint256 c', 's, a, b, c', ['0x23b872dd', ADDR, 1n, 100n]));
  it('balanceOf(address)', () => sel('bytes4 s, uint160 a', 's, a', ['0x70a08231', ADDR]));
});

describe('abi.encode (evmCompat): multiple dynamic (head/tail offset accumulation)', () => {
  it('two dynamic bytes', () => enc('bytes memory a, bytes memory b', 'a, b', ['0xaabb', '0xccddee']));
  it('two dynamic bytes (first crosses a pad boundary)', () => enc('bytes memory a, bytes memory b', 'a, b', [`0x${'11'.repeat(40)}`, '0xcc']));
  it('string then bytes', () => enc('string memory a, bytes memory b', 'a, b', ['hello world', '0xdeadbeef']));
  it('bytes then string', () => enc('bytes memory a, string memory b', 'a, b', ['0xcafe', 'the quick brown fox']));
  it('two empty dynamic', () => enc('bytes memory a, bytes memory b', 'a, b', ['0x', '0x']));
  it('uint between two dynamic: (bytes, uint, bytes)', () => enc('bytes memory a, uint b, bytes memory c', 'a, b, c', ['0xaa', 42n, '0xbbcc'])); // eslint-disable-line max-len
  it('static head then two dynamic: (uint, bytes, string)', () => enc('uint a, bytes memory b, string memory c', 'a, b, c', [7n, '0x1234', 'zzz'])); // eslint-disable-line max-len
  it('two dynamic then static: (bytes, string, uint)', () => enc('bytes memory a, string memory b, uint c', 'a, b, c', ['0xff', 'ab', 99n])); // eslint-disable-line max-len
  it('three dynamic bytes', () => enc('bytes memory a, bytes memory b, bytes memory c', 'a, b, c', ['0xaa', '0xbbbb', '0xcccccc'])); // eslint-disable-line max-len
  it('address + two dynamic (transfer-with-data shape)', () => enc('uint160 to, bytes memory data, string memory memo', 'to, data, memo', [0x1122334455667788990011223344556677889900n, '0xdeadbeef', 'gm'])); // eslint-disable-line max-len
});

describe('abi.encodeWithSelector (evmCompat): multiple dynamic', () => {
  const sel = (params: string, selArgs: string, args: readonly unknown[]): Promise<void> =>
    assertEncodeConformant(selCase({ params, selectorAndArgs: selArgs, args }));
  it('selector + two dynamic bytes', () => sel('bytes4 s, bytes memory a, bytes memory b', 's, a, b', ['0x12345678', '0xaa', '0xbbcc']));
  it('multicall-shaped: selector + bytes + bytes', () => sel('bytes4 s, bytes memory a, bytes memory b', 's, a, b', ['0xac9650d8', `0x${'11'.repeat(36)}`, `0x${'22'.repeat(4)}`])); // eslint-disable-line max-len
});
