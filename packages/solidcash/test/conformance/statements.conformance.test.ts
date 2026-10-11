// Statement-level conformance: the same function body runs as an internal function on the EVM and as a private
// helper on BCH, in both compile modes, and must produce the same value. Covers what single-expression cases cannot:
// loops, branches and early returns, memory arrays and structs, and bytes/string values.
import { describe, it } from 'vitest';
import { assertConformant, fnCase } from './harness.js';

// A loop body outruns the operation budget a small script's own length buys; its deployer adds a density reserve.
const LOOP_RESERVE = 512;

const run = (
  label: string, params: string, retType: string, body: string, args: readonly unknown[],
  opts: { decls?: string; densityReserve?: number; evmCompat?: boolean } = {},
): Promise<void> => assertConformant(fnCase({ label, params, retType, body, args, ...opts }));

describe('statements: control flow', () => {
  it('for loop accumulates', () => run('for', 'uint n', 'uint',
    'uint s = 0; for (uint i = 0; i < n; i++) { s += i * i; } return s;', [10n]));
  it('break and continue', () => run('break-continue', 'uint n', 'uint',
    'uint s = 0; for (uint i = 0; i < n; i++) { if (i % 3 == 0) continue; if (i > 12) break; s += i; } return s;',
    [20n], { densityReserve: LOOP_RESERVE }));
  it('while(true) left by an early return', () => run('while-return', 'uint x', 'uint',
    'uint i = 0; while (true) { if (i * i > x) return i; i++; }', [50n]));
  it('do-while runs at least once', () => run('do-while', 'uint x', 'uint',
    'uint c = 0; do { c++; x /= 2; } while (x > 0); return c;', [1000n]));
  it('nested loops', () => run('nested', 'uint a, uint b', 'uint',
    'uint s = 0; for (uint i = 0; i < a; i++) { for (uint j = 0; j < b; j++) { s += i * j; } } return s;',
    [4n, 5n], { densityReserve: LOOP_RESERVE }));
  it('signed loop counter', () => run('signed-loop', 'int a', 'int',
    'int s = 0; for (int i = -a; i <= a; i++) { s += i * i * i + i; } return s;', [5n],
    { densityReserve: LOOP_RESERVE }));
  it('early return from a nested branch', () => run('nested-return', 'uint a, uint b', 'uint',
    'if (a > b) { if (a > 2 * b) return 2; return 1; } return 0;', [10n, 3n]));
  it('&& short-circuits before a division by zero', () => run('short-circuit-and', 'uint x', 'bool',
    'return (x > 0 && 10 / x > 2) || x == 0;', [0n]));
  it('|| short-circuits before a division by zero', () => run('short-circuit-or', 'uint x', 'bool',
    'return x == 0 || 10 / x > 2;', [0n]));
  it('else-if chain assigns once', () => run('else-if', 'uint x', 'uint',
    'uint r; if (x < 10) { r = 1; } else if (x < 100) { r = 2; } else { r = 3; } return r * 10 + x % 7;', [57n]));
});

describe('statements: memory arrays', () => {
  it('dynamic memory array written and read in loops', () => run('mem-dyn', 'uint n', 'uint',
    'uint[] memory a = new uint[](n); for (uint i = 0; i < n; i++) { a[i] = i * 3; } uint s = 0; '
    + 'for (uint i = 0; i < n; i++) { s += a[i]; } return s + a.length;', [6n]));
  it('fixed memory array literal updated in place', () => run('mem-fixed', 'uint k', 'uint',
    'uint[4] memory a = [uint(1), 2, 3, 4]; a[2] = k; return a[0] + a[1] + a[2] + a[3];', [10n]));
  it('a memory array assigned to another name aliases it', () => run('mem-alias', 'uint k', 'uint',
    'uint[] memory a = new uint[](2); uint[] memory b = a; b[0] = k; return a[0];', [7n]));
  it('array of memory structs', () => run('mem-structs', 'uint n', 'uint',
    'P[] memory ps = new P[](n); for (uint i = 0; i < n; i++) { ps[i] = P(i, i + 1); } uint s = 0; '
    + 'for (uint i = 0; i < n; i++) { s += ps[i].x * ps[i].y; } return s;', [3n],
    { decls: 'struct P { uint x; uint y; }' }));
});

describe('statements: memory structs', () => {
  it('struct constructed and a field updated', () => run('struct-update', 'uint a, uint b', 'uint',
    'P memory p = P(a, b); p.x += 1; return p.x * p.y;', [3n, 4n], { decls: 'struct P { uint x; uint y; }' }));
  it('nested struct field read through two levels', () => run('struct-nested', 'uint a', 'uint',
    'Outer memory o = Outer(Inner(a, a + 1), 5); o.inner.y *= 2; return o.inner.x + o.inner.y + o.z;', [4n],
    { decls: 'struct Inner { uint x; uint y; } struct Outer { Inner inner; uint z; }' }));
});

describe('statements: bytes and strings', () => {
  it('bytes built byte by byte and hashed with sha256', () => run('bytes-sha256', 'uint8 c', 'bytes32',
    'bytes memory b = new bytes(3); b[0] = bytes1(c); b[1] = 0x62; b[2] = 0x63; return sha256(b);', [0x61n]));
  it('string length through bytes()', () => run('string-length', 'string memory s', 'uint',
    'return bytes(s).length;', ['hello world']));
  it('string.concat', () => run('string-concat', 'string memory s', 'string memory',
    'return string.concat(s, "!");', ['hi']));
  it('bytes.concat and indexing', () => run('bytes-concat-index', 'uint8 v', 'uint8',
    'bytes memory b = bytes.concat(bytes2(0x1234), bytes1(v)); return uint8(b[2]);', [0x56n]));
  // Native encodePacked pads integers to their BCH sign-magnitude width (website/docs/language/abi-encoding.md).
  it('abi.encodePacked length of mixed widths (evmCompat)', () => run('packed-length', 'uint8 a', 'uint',
    'return abi.encodePacked(a, uint16(2), bytes3(0x010203)).length;', [1n], { evmCompat: true }));
  it('literal zero and string written past the second byte', () => run('bytes-literal-writes', 'uint8 i', 'bytes32',
    'bytes memory b = new bytes(4); b[3] = 0x7a; b[2] = "c"; b[i] = 0; b[0] = 0x61; return sha256(b);', [1n]));
});

describe('statements: integer edges', () => {
  it('exponent of runtime values', () => run('exp', 'uint a, uint b', 'uint', 'return a ** b;', [3n, 20n]));
  it('addmod and mulmod do not overflow', () => run('addmod-mulmod', 'uint a, uint b, uint m', 'uint',
    'return addmod(a, b, m) + mulmod(a, b, m);', [(1n << 255n) + 3n, (1n << 255n) + 5n, 7n]));
  it('uint8 left shift truncates instead of reverting', () => run('shift-truncates', 'uint8 a', 'uint8',
    'return (a << 4) >> 2;', [200n]));
  it('compound left shift on uint16 truncates', () => run('shift-compound', 'uint16 a', 'uint16',
    'a <<= 9; return a;', [0x1234n]));
  it('int8 left shift wraps into the sign bit', () => run('shift-signed', 'int8 a', 'int8',
    'return a << 1;', [64n]));
  it('bitwise not of uint8', () => run('not-uint8', 'uint8 a', 'uint8', 'return ~a;', [200n]));
  it('signed right shift rounds toward negative infinity', () => run('sar', 'int a', 'int', 'return a >> 1;', [-7n]));
});
