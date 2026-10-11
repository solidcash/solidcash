// Memory-model values on both VMs: nested arrays, structs that hold arrays, struct arrays and aliasing through them,
// and dynamic values crossing abi.encode/abi.decode. Each body runs as an internal Solidity function and as a
// private SolidCash helper, in both compile modes unless pinned.
import { describe, it } from 'vitest';
import { assertConformant, fnCase } from './harness.js';

const run = (
  label: string, params: string, retType: string, body: string, args: readonly unknown[],
  opts: { decls?: string; evmCompat?: boolean; densityReserve?: number } = {},
): Promise<void> => assertConformant(fnCase({ label, params, retType, body, args, ...opts }));

const ALIAS_ROWS = 'uint256[][] memory g = new uint256[][](2); uint256[] memory row = new uint256[](2); g[0] = row; '
  + 'g[1] = row; g[0][1] = v; return g[1][1];';
const READ_ALIAS_ROW = 'uint256[][] memory g = new uint256[][](2); g[0] = new uint256[](2); uint256[] memory r = g[0]; '
  + 'r[0] = v; return g[0][0];';
const BUILD_ROWS = 'function build(uint256 v) internal pure returns (uint256[][] memory) { uint256[][] memory g = '
  + 'new uint256[][](2); uint256[] memory row = new uint256[](2); g[0] = row; g[1] = row; g[0][1] = v; return g; }';

describe('memory: nested arrays', () => {
  it('a 2-D array filled in loops', () => run('array-2d', 'uint256 n', 'uint256',
    'uint256[][] memory g = new uint256[][](n); for (uint256 i = 0; i < n; i++) { g[i] = new uint256[](i + 1); '
    + 'for (uint256 j = 0; j <= i; j++) { g[i][j] = i * 10 + j; } } return g[n - 1][n - 1] + g[1][0] + g.length;',
    [2n], { densityReserve: 512 }));
  it.each([false, true])('an inner array aliased through an outer one (evmCompat %s)', (evmCompat) =>
    run('array-2d-alias', 'uint256 v', 'uint256', ALIAS_ROWS, [7n], { evmCompat }));
  it.each([false, true])('an inner array read out of an outer one and written (evmCompat %s)', (evmCompat) =>
    run('array-2d-read-alias', 'uint256 v', 'uint256', READ_ALIAS_ROW, [5n], { evmCompat }));
  it('a 2-D array with an aliased row returned by a helper', () => run('array-2d-return', 'uint256 v', 'uint256',
    'uint256[][] memory h = build(v); return h[1][1] * 10 + h.length;', [7n], { decls: BUILD_ROWS, densityReserve: 512 }));
  it('a fixed 2-D array', () => run('array-fixed-2d', 'uint256 v', 'uint256',
    'uint256[2][3] memory m; m[2][1] = v; m[0][0] = 1; return m[2][1] * 10 + m[0][0] + m[1][1];', [4n]));
});

describe('memory: structs with arrays', () => {
  it('a struct holding an array', () => run('struct-array-field', 'uint256 n', 'uint256',
    'Bag memory b = Bag(new uint256[](n), 5); for (uint256 i = 0; i < n; i++) { b.items[i] = i + b.tag; } '
    + 'return b.items[n - 1] + b.items.length;', [3n], { decls: 'struct Bag { uint256[] items; uint256 tag; }' }));
  it('an array of structs mutated through an alias', () => run('struct-array-alias', 'uint256 v', 'uint256',
    'P[] memory ps = new P[](2); ps[0] = P(1, 2); ps[1] = P(3, 4); P memory q = ps[1]; q.y = v; '
    + 'return ps[1].y * 10 + ps[0].x;', [9n], { decls: 'struct P { uint256 x; uint256 y; }' }));
  it('a fixed array of structs', () => run('struct-fixed-array', 'uint256 v', 'uint256',
    'P[2] memory ps; ps[1].x = v; ps[0] = P(1, 1); return ps[1].x + ps[0].y;', [6n],
    { decls: 'struct P { uint256 x; uint256 y; }' }));
});

describe('memory: dynamic values through abi', () => {
  it('a dynamic array round trip', () => run('abi-array', 'uint256 n', 'uint256',
    'uint256[] memory a = new uint256[](n); for (uint256 i = 0; i < n; i++) { a[i] = i * i; } '
    + 'uint256[] memory b = abi.decode(abi.encode(a), (uint256[])); return b[n - 1] + b.length;', [4n]));
  it('a string round trip', () => run('abi-string', 'string memory s', 'string memory',
    'return abi.decode(abi.encode(s, uint256(1)), (string));', ['round trip']));
  it('bytes slicing through a loop', () => run('bytes-copy-range', 'bytes memory b, uint256 from', 'bytes memory',
    'bytes memory out = new bytes(b.length - from); for (uint256 i = from; i < b.length; i++) { out[i - from] = b[i]; } '
    + 'return out;', ['0x0102030405', 2n]));
});
