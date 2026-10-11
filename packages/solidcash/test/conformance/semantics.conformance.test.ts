// Value and revert semantics that single-expression cases leave out: two's-complement bitwise on signed values,
// shifts past the type width, bytesN shifts and indexing, type(T) bounds, tuples, delete, and the checks that must
// revert on both VMs. Each body runs as an internal Solidity function and as a private SolidCash helper.
import { describe, it } from 'vitest';
import { assertConformant, assertReverts, fnCase, fnRevertCase } from './harness.js';

const run = (
  label: string, params: string, retType: string, body: string, args: readonly unknown[],
  opts: { decls?: string; evmCompat?: boolean } = {},
): Promise<void> => assertConformant(fnCase({ label, params, retType, body, args, ...opts }));

const reverts = (
  label: string, params: string, retType: string, body: string, args: readonly unknown[],
): Promise<void> => assertReverts(fnRevertCase({ label, params, retType, body, args }));

describe('semantics: signed bitwise', () => {
  it('int8 and', () => run('and-int8', 'int8 a, int8 b', 'int8', 'return a & b;', [-8n, 7n]));
  it('int8 xor', () => run('xor-int8', 'int8 a, int8 b', 'int8', 'return a ^ b;', [-1n, 5n]));
  it('int256 or', () => run('or-int256', 'int256 a, int256 b', 'int256', 'return a | b;', [-2n, 1n]));
  it('int256 not of zero', () => run('not-int256', 'int256 a', 'int256', 'return ~a;', [0n]));
  it('int8 not of the minimum', () => run('not-int8-min', 'int8 a', 'int8', 'return ~a;', [-128n]));
  it('int16 right shift rounds down', () => run('sar-int16', 'int16 a', 'int16', 'return a >> 3;', [-100n]));
});

describe('semantics: shifts past the width', () => {
  it('uint256 << 300 is zero', () => run('shl-past', 'uint256 a', 'uint256', 'return a << 300;', [5n]));
  it('uint256 >> 300 is zero', () => run('shr-past', 'uint256 a', 'uint256', 'return a >> 300;', [5n]));
  it('uint8 << 8 is zero', () => run('shl-uint8-width', 'uint8 a', 'uint8', 'return a << 8;', [255n]));
});

describe('semantics: bytesN', () => {
  it('bytes4 left shift', () => run('bytes4-shl', 'bytes4 x', 'bytes4', 'return x << 8;', ['0x12345678']));
  it('bytes4 right shift', () => run('bytes4-shr', 'bytes4 x', 'bytes4', 'return x >> 4;', ['0x12345678']));
  it('bytes1 ordering', () => run('bytes1-lt', 'bytes1 a, bytes1 b', 'bool', 'return a < b;', ['0x41', '0x42']));
  it('bytes2 indexing', () => run('bytes2-index', 'bytes2 x', 'bytes1', 'return x[1];', ['0x1234']));
  it('bytes32 of a uint is big-endian (evmCompat)', () => run('bytes32-from-uint', 'uint256 x', 'uint8',
    'bytes32 h = bytes32(x); return uint8(h[31]);', [0x0102n], { evmCompat: true }));
});

describe('semantics: type bounds, tuples and delete', () => {
  it('type(uint8).max', () => run('uint8-max', 'uint256 x', 'uint256', 'return type(uint8).max + x;', [0n]));
  it('type(int16).min', () => run('int16-min', 'int256 x', 'int256', 'return type(int16).min + x;', [0n]));
  it('type(uint256).max minus one', () => run('uint256-max', 'uint256 x', 'uint256',
    'return type(uint256).max - x;', [1n]));
  it('tuple swap', () => run('tuple-swap', 'uint256 a, uint256 b', 'uint256',
    '(a, b) = (b, a); return a * 10 + b;', [1n, 2n]));
  it('delete of a memory array element', () => run('delete-element', 'uint256 v', 'uint256',
    'uint256[] memory a = new uint256[](3); a[1] = v; delete a[1]; return a[1] + a.length;', [5n]));
  it('delete of a memory struct', () => run('delete-struct', 'uint256 v', 'uint256',
    'P memory p = P(v, v + 1); delete p; return p.x + p.y;', [1n], { decls: 'struct P { uint256 x; uint256 y; }' }));
});

describe('semantics: arithmetic shapes', () => {
  it('signed division and remainder truncate toward zero', () => run('signed-divmod', 'int256 a, int256 b', 'int256',
    'return a / b * 1000 + a % b;', [-7n, 2n]));
  it('nested ternary', () => run('ternary-nested', 'uint256 a', 'uint256',
    'return a > 5 ? (a > 8 ? 2 : 1) : 0;', [7n]));
  it('string equality through sha256', () => run('string-sha256-eq', 'string memory a, string memory b', 'bool',
    'return sha256(bytes(a)) == sha256(bytes(b));', ['x', 'x']));
  it('abi.encode and abi.decode round trip', () => run('abi-roundtrip', 'uint256 a, uint256 c', 'uint256',
    'bytes memory b = abi.encode(a, c); (uint256 x, uint256 y) = abi.decode(b, (uint256, uint256)); return x * 10 + y;',
    [3n, 4n]));
  it('string built with encodePacked', () => run('string-packed', 'string memory s', 'string memory',
    'return string(abi.encodePacked(s, "!"));', ['hi']));
});

describe('semantics: reverts on both VMs', () => {
  it('uint8 addition overflow', () => reverts('uint8-add-overflow', 'uint8 a', 'uint8', 'return a + 1;', [255n]));
  it('int8 negation of the minimum', () => reverts('int8-neg-min', 'int8 a', 'int8', 'return -a;', [-128n]));
  it('power overflow', () => reverts('pow-overflow', 'uint256 a', 'uint256', 'return 2 ** a;', [256n]));
  it('division by zero', () => reverts('div-zero', 'uint256 a, uint256 b', 'uint256', 'return a / b;', [1n, 0n]));
  it('modulo by zero', () => reverts('mod-zero', 'uint256 a, uint256 b', 'uint256', 'return a % b;', [1n, 0n]));
  it('array index out of bounds', () => reverts('oob', 'uint256 i', 'uint256',
    'uint256[] memory x = new uint256[](2); return x[i];', [2n]));
  it('require with a message', () => reverts('require-msg', 'uint256 a', 'uint256',
    'require(a > 10, "small"); return a;', [5n]));
  it('assert', () => reverts('assert', 'uint256 a', 'uint256', 'assert(a != 3); return a;', [3n]));
  it('int256 subtraction underflow', () => reverts('int256-sub', 'int256 a', 'int256',
    'return a - 1;', [-(1n << 255n)]));
  it('uint subtraction underflow', () => reverts('uint-sub', 'uint256 a', 'uint256', 'return a - 1;', [0n]));
});
