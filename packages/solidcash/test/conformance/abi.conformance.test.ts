// abi.encode EVM byte-parity (evmCompat). The Solidity side returns abi.encode(...) as bytes; the BCH side
// under evmCompat must produce byte-identical output. Phase 1: static value types (32-byte words).
import { describe, it } from 'vitest';
import {
  assertAbi, abiCase, selCase, sigCase, callCase, abiStructCase, abiStructMixedCase, assertEncodeConformant,
} from './harness.js';

const MAX = (1n << 256n) - 1n;
const INT_MIN = -(1n << 255n);
const hb = (h: string): Uint8Array => Uint8Array.from((h.slice(2).match(/../g) ?? []).map((b) => parseInt(b, 16)));

const enc = (params: string, encodeArgs: string, args: readonly unknown[]): Promise<void> =>
  assertAbi(abiCase({ params, encodeArgs, args }));

const pack = (params: string, encodeArgs: string, args: readonly unknown[]): Promise<void> =>
  assertAbi(abiCase({ params, encodeArgs, args, packed: true }));

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

describe('abi.encodePacked (evmCompat): dynamic types', () => {
  it('bytes (raw, no length prefix)', () => pack('bytes memory a', 'a', ['0xdeadbeef']));
  it('string (raw utf8)', () => pack('string memory a', 'a', ['hello']));
  it('uint256[] (element words, no length)', () => pack('uint256[] memory a', 'a', [[1n, 2n, 3n]]));
  it('uint8[] (elements padded to 32)', () => pack('uint8[] memory a', 'a', [[1n, 2n, 3n]]));
  it('bytes + uint (mixed)', () => pack('bytes memory a, uint b', 'a, b', ['0xaa', 5n]));
  it('uint + bytes (mixed)', () => pack('uint a, bytes memory b', 'a, b', [5n, '0xaa']));
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
    assertAbi(selCase({ params, selectorAndArgs: selArgs, args }));
  it('selector only (no args)', () => sel('bytes4 s', 's', ['0xaabbccdd']));
  it('selector + uint', () => sel('bytes4 s, uint a', 's, a', ['0xdeadbeef', 42n]));
  it('selector + two uint', () => sel('bytes4 s, uint a, uint b', 's, a, b', ['0x12345678', 1n, 2n]));
  it('selector + int + bool', () => sel('bytes4 s, int a, bool b', 's, a, b', ['0x11223344', -7n, true]));
  it('selector + uint + trailing bytes', () => sel('bytes4 s, uint a, bytes memory b', 's, a, b', ['0x11223344', 5n, '0xcafe']));
});

describe('abi.encodeWithSignature (evmCompat): keccak256 selector + EVM args', () => {
  const sig = (signature: string, params: string, encodeArgs: string, args: readonly unknown[]): Promise<void> =>
    assertAbi(sigCase({ signature, params, encodeArgs, args }));
  it('transfer(address,uint256)', () => sig(
    'transfer(address,uint256)', 'uint160 to, uint256 amt', 'to, amt', [0x1122334455667788990011223344556677889900n, 1000n]));
  it('no args - selector only', () => sig('poke()', '', '', []));
  it('single uint256', () => sig('bar(uint256)', 'uint256 x', 'x', [42n]));
  it('two static (uint256,bool)', () => sig('f(uint256,bool)', 'uint256 a, bool b', 'a, b', [7n, true]));
  it('dynamic arg baz(bytes)', () => sig('baz(bytes)', 'bytes memory b', 'b', [hb('0xdeadbeef')]));
  it('mixed static+dynamic m(uint256,bytes,bool)', () => sig(
    'm(uint256,bytes,bool)', 'uint256 a, bytes memory b, bool c', 'a, b, c', [7n, hb('0xcafe'), true]));
  it('dynamic array g(uint256[])', () => sig('g(uint256[])', 'uint256[] memory a', 'a', [[1n, 2n, 3n]]));
});

describe('abi.encodeCall (evmCompat): keccak256 selector + EVM args', () => {
  it('IBox.set(uint256)', () => assertAbi(callCase({
    ifaceName: 'IBox', ifaceDecl: 'function set(uint256 x) external;',
    method: 'set', canonicalSig: 'set(uint256)', params: 'uint256 x', encodeArgs: 'x', args: [42n],
  })));
  it('IPair.put(uint256,bool) (two static)', () => assertAbi(callCase({
    ifaceName: 'IPair', ifaceDecl: 'function put(uint256 a, bool b) external;',
    method: 'put', canonicalSig: 'put(uint256,bool)', params: 'uint256 a, bool b', encodeArgs: 'a, b', args: [7n, true],
  })));
  it('IData.store(bytes) (dynamic arg)', () => assertAbi(callCase({
    ifaceName: 'IData', ifaceDecl: 'function store(bytes memory b) external;',
    method: 'store', canonicalSig: 'store(bytes)', params: 'bytes memory b', encodeArgs: 'b', args: [hb('0xdeadbeef')],
  })));
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
    assertAbi(selCase({ params, selectorAndArgs: selArgs, args }));
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
    assertAbi(selCase({ params, selectorAndArgs: selArgs, args }));
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
    assertAbi(selCase({ params, selectorAndArgs: selArgs, args }));
  it('selector + two dynamic bytes', () => sel('bytes4 s, bytes memory a, bytes memory b', 's, a, b', ['0x12345678', '0xaa', '0xbbcc']));
  it('multicall-shaped: selector + bytes + bytes', () => sel('bytes4 s, bytes memory a, bytes memory b', 's, a, b', ['0xac9650d8', `0x${'11'.repeat(36)}`, `0x${'22'.repeat(4)}`])); // eslint-disable-line max-len
});

describe('abi.encode (evmCompat): dynamic arrays of fixed-width value types', () => {
  it('uint256[] three elements', () => enc('uint256[] memory a', 'a', [[1n, 2n, 3n]]));
  it('uint256[] single', () => enc('uint256[] memory a', 'a', [[42n]]));
  it('uint256[] empty', () => enc('uint256[] memory a', 'a', [[]]));
  it('uint256[] large values (max, 2^255, 2^255-1)', () => enc('uint256[] memory a', 'a', [[MAX, 1n << 255n, (1n << 255n) - 1n]]));
  it('uint128[] (narrower fixed width)', () => enc('uint128[] memory a', 'a', [[1n, 2n, (1n << 128n) - 1n]]));
  it('uint + uint256[] (static head then array)', () => enc('uint a, uint256[] memory b', 'a, b', [7n, [10n, 20n]]));
  it('uint256[] + uint (array then static)', () => enc('uint256[] memory a, uint b', 'a, b', [[1n, 2n], 99n]));
  it('int256[] mixed sign', () => enc('int256[] memory a', 'a', [[-1n, 5n, -100n]]));
  it('int256[] min/max boundary', () => enc('int256[] memory a', 'a', [[-(1n << 255n), (1n << 255n) - 1n, 0n]]));
  it('int128[] negatives', () => enc('int128[] memory a', 'a', [[-1n, -(1n << 100n), 7n]]));
  // bytesN array elements must be Uint8Array for the SDK's packFixedWidthElement (hex-string auto-conversion is
  // scalar-only); ethers accepts Uint8Array too.
  it('bytes32[] (right-padded, no reverse)', () => enc('bytes32[] memory a', 'a', [[hb(`0x${'ab'.repeat(32)}`), hb(`0x${'cd'.repeat(32)}`)]]));
  it('bytes4[] (short, right-padded to 32)', () => enc('bytes4[] memory a', 'a', [[hb('0xdeadbeef'), hb('0x01020304')]]));
  it('bool[]', () => enc('bool[] memory a', 'a', [[true, false, true]]));
  it('uint[] alias (== uint256[])', () => enc('uint[] memory a', 'a', [[1n, 2n, 3n]]));
  it('int[] alias (== int256[])', () => enc('int[] memory a', 'a', [[-1n, 5n, -100n]]));
  it('two arrays: uint256[] + uint256[]', () => enc('uint256[] memory a, uint256[] memory b', 'a, b', [[1n, 2n], [3n, 4n, 5n]]));
  it('selector + uint256[] (batched call data)', () => assertAbi(selCase({
    params: 'bytes4 s, uint256[] memory a', selectorAndArgs: 's, a', args: ['0xabcdef12', [1n, 2n, 3n]],
  })));
  it('uint160 + uint256[] (transfer-batch shape)', () => enc('uint160 to, uint256[] memory ids', 'to, ids', [0x1122n, [7n, 8n]]));
});

describe('abi.encode (evmCompat): arrays of DYNAMIC elements (recursive head/tail)', () => {
  it('bytes[] two elements', () => enc('bytes[] memory a', 'a', [[hb('0xdeadbeef'), hb('0xcafe')]]));
  it('bytes[] single', () => enc('bytes[] memory a', 'a', [[hb('0xaabbcc')]]));
  it('bytes[] empty', () => enc('bytes[] memory a', 'a', [[]]));
  it('bytes[] element crosses pad boundary', () => enc('bytes[] memory a', 'a', [[hb(`0x${'11'.repeat(40)}`), hb('0xff')]]));
  it('string[]', () => enc('string[] memory a', 'a', [['hello', 'the quick brown fox']]));
  it('uint256[][] nested', () => enc('uint256[][] memory a', 'a', [[[1n, 2n], [3n, 4n, 5n]]]));
  it('uint + bytes[] (mixed)', () => enc('uint x, bytes[] memory a', 'x, a', [7n, [hb('0xaa'), hb('0xbb')]]));
});

describe('abi.encode (evmCompat): fixed-width structs (ABI tuple, inline)', () => {
  type F = { type: string; name: string };
  const st = (fields: F[], values: unknown[]): Promise<void> =>
    assertEncodeConformant(abiStructCase({ fields, values }));
  it('struct {uint256, bool}', () => st([{ type: 'uint256', name: 'a' }, { type: 'bool', name: 'b' }], [7n, true]));
  it('struct {uint256, uint256}', () => st([{ type: 'uint256', name: 'a' }, { type: 'uint256', name: 'b' }], [123n, 456n]));
  it('struct {uint128, uint64, bool}', () => st(
    [{ type: 'uint128', name: 'a' }, { type: 'uint64', name: 'b' }, { type: 'bool', name: 'c' }], [1n, 2n, true]));
  it('struct {uint160, uint256}', () => st([{ type: 'uint160', name: 'a' }, { type: 'uint256', name: 'b' }], [0x1122n, 999n]));
  it('struct {bytes32, bool}', () => st(
    [{ type: 'bytes32', name: 'a' }, { type: 'bool', name: 'b' }], [hb(`0x${'ab'.repeat(32)}`), false]));
  it('struct {int256, int256} mixed sign', () => st(
    [{ type: 'int256', name: 'a' }, { type: 'int256', name: 'b' }], [-5n, 7n]));
});

describe('abi.encode (evmCompat): dynamic structs (tuple head/tail)', () => {
  type F = { type: string; name: string };
  const st = (fields: F[], values: unknown[]): Promise<void> =>
    assertEncodeConformant(abiStructCase({ fields, values }));
  it('struct {uint256, bytes}', () => st(
    [{ type: 'uint256', name: 'a' }, { type: 'bytes', name: 'b' }], [7n, hb('0xdeadbeef')]));
  it('struct {bytes, uint256} (dynamic first)', () => st(
    [{ type: 'bytes', name: 'b' }, { type: 'uint256', name: 'a' }], [hb('0xcafe'), 42n]));
  it('struct {uint256, string}', () => st(
    [{ type: 'uint256', name: 'a' }, { type: 'string', name: 's' }], [1n, 'hello world']));
  it('struct {bytes, bytes} two dynamics', () => st(
    [{ type: 'bytes', name: 'a' }, { type: 'bytes', name: 'b' }], [hb('0xaa'), hb(`0x${'bb'.repeat(40)}`)]));
  it('struct {uint256, bool, bytes}', () => st(
    [{ type: 'uint256', name: 'a' }, { type: 'bool', name: 'c' }, { type: 'bytes', name: 'b' }], [9n, true, hb('0x1234')]));
});

describe('abi.encode (evmCompat): static struct + dynamic (head-size generalization)', () => {
  type F = { type: string; name: string };
  const mix = (fields: F[], values: unknown[], tailType: string, tailValue: unknown): Promise<void> =>
    assertEncodeConformant(abiStructMixedCase({ fields, values, tailType, tailName: 'd', tailValue }));
  it('(struct{uint256,bool}, bytes)', () => mix(
    [{ type: 'uint256', name: 'a' }, { type: 'bool', name: 'b' }], [7n, true], 'bytes', hb('0xdeadbeef')));
  it('(struct{uint128,uint64,bool}, bytes) 3-word head', () => mix(
    [{ type: 'uint128', name: 'a' }, { type: 'uint64', name: 'b' }, { type: 'bool', name: 'c' }], [1n, 2n, true],
    'bytes', hb(`0x${'ab'.repeat(40)}`)));
  it('(struct{uint256,uint256}, string)', () => mix(
    [{ type: 'uint256', name: 'a' }, { type: 'uint256', name: 'b' }], [11n, 22n], 'string', 'hello world'));
});

describe('abi.encode (evmCompat): fixed-size arrays (inline, static)', () => {
  it('uint256[3]', () => enc('uint256[3] memory a', 'a', [[1n, 2n, 3n]]));
  it('uint256[2] max + zero', () => enc('uint256[2] memory a', 'a', [[MAX, 0n]]));
  it('int256[3] mixed sign', () => enc('int256[3] memory a', 'a', [[-1n, 5n, -100n]]));
  it('uint128[4]', () => enc('uint128[4] memory a', 'a', [[1n, 2n, 3n, 4n]]));
  it('bool[2]', () => enc('bool[2] memory a', 'a', [[true, false]]));
  it('bytes32[2]', () => enc('bytes32[2] memory a', 'a', [[hb(`0x${'ab'.repeat(32)}`), hb(`0x${'cd'.repeat(32)}`)]]));
  it('uint160[2] address-shaped', () => enc('uint160[2] memory a', 'a', [[0x1122n, 0x3344n]]));
  it('uint + uint256[3] (mixed static)', () => enc('uint x, uint256[3] memory a', 'x, a', [9n, [1n, 2n, 3n]]));
  it('uint256[2] + bytes (static array before dynamic)', () => enc('uint256[2] memory a, bytes memory d', 'a, d', [[7n, 8n], hb('0xdeadbeef')]));
});
