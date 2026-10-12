// Value and revert semantics that single-expression cases leave out: two's-complement bitwise on signed values,
// shifts past the type width, bytesN shifts and indexing, type(T) bounds, tuples, delete, and the checks that must
// revert on both VMs. Each body runs as an internal Solidity function and as a private SolidCash helper.
import { describe, it } from 'vitest';
import { asmCase, assertConformant, assertReverts, fnCase, fnRevertCase } from './harness.js';

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

// Runtime amounts below, at and far past the width: 0 for << and for >> of a non-negative value, -1 for >> of a
// negative one.
const MAX = (1n << 256n) - 1n;
const amountsFor = (bits: number): bigint[] => [0n, BigInt(bits - 1), BigInt(bits), BigInt(bits + 1), 1n << 255n, MAX];
const shifts = async (label: string, type: string, op: string, x: bigint): Promise<void> => {
  const bits = Number(type.replace(/^u?int/, ''));
  for (const n of amountsFor(bits)) {
    await run(`${label}-${n}`, `${type} a, uint256 n`, type, `return a ${op} n;`, [x, n]);
  }
};

describe('semantics: shifts by a runtime amount', () => {
  it('uint256 <<', () => shifts('shl-uint256', 'uint256', '<<', 5n));
  it('uint256 >>', () => shifts('shr-uint256', 'uint256', '>>', MAX));
  it('int256 << of a negative value', () => shifts('shl-int256-neg', 'int256', '<<', -3n));
  it('int256 << of a positive value', () => shifts('shl-int256-pos', 'int256', '<<', 3n));
  it('int256 >> of a negative value', () => shifts('shr-int256-neg', 'int256', '>>', -3n));
  it('int256 >> of a positive value', () => shifts('shr-int256-pos', 'int256', '>>', 3n));
  it('uint8 <<', () => shifts('shl-uint8', 'uint8', '<<', 255n));
  it('uint8 >>', () => shifts('shr-uint8', 'uint8', '>>', 255n));
  it('int8 << of a negative value', () => shifts('shl-int8-neg', 'int8', '<<', -3n));
  it('int8 >> of a negative value', () => shifts('shr-int8-neg', 'int8', '>>', -100n));
  it('uint256 << by a uint8 amount', () => run('shl-uint8-amount', 'uint256 a, uint8 n', 'uint256',
    'return a << n;', [5n, 255n]));
  it('Yul shr', async () => {
    for (const n of amountsFor(256)) {
      await assertConformant(asmCase({ params: 'uint sh, uint v', retType: 'uint', yul: 'r := shr(sh, v)',
        args: [n, MAX], label: `yul-shr-${n}` }));
    }
  });
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

// keccak256 runs in a compute side-car the SDK co-spends; encodePacked follows the EVM layout under evmCompat.
describe('semantics: keccak256 (evmCompat)', () => {
  it('of packed integers', () => run('keccak-packed', 'uint256 a, uint8 b', 'bytes32',
    'return keccak256(abi.encodePacked(a, b));', [7n, 9n], { evmCompat: true }));
  it('of an abi-encoded pair', () => run('keccak-encode', 'uint256 a, address b', 'bytes32',
    'return keccak256(abi.encode(a, b));', [1n, '0x00000000000000000000000000000000000000aa'], { evmCompat: true }));
  it('of a string', () => run('keccak-string', 'string memory s', 'bytes32',
    'return keccak256(bytes(s));', ['hello'], { evmCompat: true }));
  it('compared to a literal hash', () => run('keccak-compare', 'string memory s', 'bool',
    'return keccak256(bytes(s)) == keccak256("abc");', ['abc'], { evmCompat: true }));
});

// A string literal has solc's bytes on every path (compile-time hash and erc7201 folds, run-time pushes, memory,
// constants): `\xNN` is one raw byte, `\uNNNN` is UTF-8, a backslash-newline continuation is dropped, and a
// unicode literal is UTF-8. Solidity text: "a\n\r\t\'\"\\\x41\xc3\xa9\u00e9\u20ac\<newline>b" (16 bytes).
const ESCAPED = '"a\\n\\r\\t\\\'\\"\\\\\\x41\\xc3\\xa9\\u00e9\\u20ac\\\nb"';
// unicode"Hello <U+1F603> <U+00E9> \u00e9 \xc3\xa9" (19 bytes).
const UNICODE = 'unicode"Hello \u{1F603} \u00e9 \\u00e9 \\xc3\\xa9"';
const INVALID_UTF8 = '"\\xff\\xc3\\xa9"';
const erc7201Formula = (id: string): string =>
  `uint256(keccak256(bytes.concat(bytes32(uint256(keccak256(bytes(${id}))) - 1))) & ~bytes32(uint256(0xff)))`;
const literal = (
  label: string, retType: string, body: string, decls?: string,
): Promise<void> => run(label, '', retType, body, [], { evmCompat: true, ...(decls ? { decls } : {}) });

describe('semantics: string literal bytes (evmCompat)', () => {
  it('keccak256 of an escaped literal', () => literal('lit-esc-keccak', 'bytes32',
    `return keccak256(bytes(${ESCAPED}));`));
  it('keccak256 folded from an escaped literal', () => literal('lit-esc-keccak-fold', 'bytes32',
    `return keccak256(${ESCAPED});`));
  it('length of an escaped literal', () => literal('lit-esc-length', 'uint256', `return bytes(${ESCAPED}).length;`));
  it('keccak256 of a unicode literal', () => literal('lit-unicode-keccak', 'bytes32',
    `return keccak256(bytes(${UNICODE}));`));
  it('length of a unicode literal', () => literal('lit-unicode-length', 'uint256',
    `return bytes(${UNICODE}).length;`));
  it('keccak256 folded from a non-UTF-8 literal', () => literal('lit-raw-keccak-fold', 'bytes32',
    `return keccak256(${INVALID_UTF8});`));
  it('keccak256 of a non-UTF-8 literal in memory', () => literal('lit-raw-memory-keccak', 'bytes32',
    `bytes memory b = ${INVALID_UTF8}; return keccak256(b);`));
  it('length of a non-UTF-8 literal in memory', () => literal('lit-raw-memory-length', 'uint256',
    `bytes memory b = ${INVALID_UTF8}; return b.length;`));
  it('a string constant holding an escaped literal', () => literal('lit-esc-constant', 'bytes32',
    'return keccak256(bytes(K));', `string constant K = ${ESCAPED};`));
  it('erc7201 of an escaped literal', () => literal('lit-esc-erc7201', 'uint256', `return erc7201(${ESCAPED});`));
  it('erc7201 of a unicode literal', () => literal('lit-unicode-erc7201', 'uint256', `return erc7201(${UNICODE});`));
  it('erc7201 of an escaped string constant', () => literal('lit-esc-erc7201-constant', 'uint256',
    'return erc7201(K);', `string constant K = ${ESCAPED};`));
  it('the erc7201 formula over an escaped literal', () => literal('lit-esc-erc7201-formula', 'uint256',
    `return ${erc7201Formula(ESCAPED)};`));
  it('erc7201 of an escaped literal equals its formula', () => literal('lit-esc-erc7201-match', 'bool',
    `return erc7201(${ESCAPED}) == ${erc7201Formula(ESCAPED)};`));
  it('erc7201 of a unicode literal equals its formula', () => literal('lit-unicode-erc7201-match', 'bool',
    `return erc7201(${UNICODE}) == ${erc7201Formula(UNICODE)};`));
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

// An inline array literal indexed in place is a `T[n] memory` value whose constant integer elements take their
// common mobile type (`uint8` for `[1, 2, 3]`), so arithmetic on an element is checked at that width.
const TWO_POW_200 = '1606938044258990275541962092341162602522202993782792835301376';
const UINT256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

describe('semantics: inline array literals indexed in place', () => {
  it('a constant index into small values', () => run('inline-const', '', 'uint256', 'return [1, 2, 3, 4][2];', []));
  it('a singleton', () => run('inline-singleton', '', 'uint256', 'return [4][0];', []));
  it('a runtime index into small values', () => run('inline-runtime', 'uint256 i', 'uint256',
    'return [1, 2, 3, 4][i];', [3n]));
  it('a constant index into large values', () => run('inline-const-large', '', 'uint256',
    `return [1, ${TWO_POW_200}, 3][1];`, []));
  it('a runtime index into large values', () => run('inline-runtime-large', 'uint256 i', 'uint256',
    `return [7, ${UINT256_MAX}][i];`, [1n]));
  it('a runtime index into signed values', () => run('inline-runtime-signed', 'uint256 i', 'int256',
    'return [-1, 2, -300][i];', [2n]));
  it('an out-of-range runtime index', () => reverts('inline-oob', 'uint256 i', 'uint256',
    'return [1, 2, 3][i];', [3n]));
  it('uint8 overflow on an element', () => reverts('inline-mobile-overflow', 'uint256 i', 'uint256',
    'return [255, 1][i] + 1;', [0n]));
});

// A conditional of integer literals has their common mobile type (`c ? 63 : 255` is uint8), so arithmetic on it is
// checked at that width, also when its condition is a literal. solc rejects mixed signs (`c ? -1 : 100`).
describe('semantics: conditionals of integer literals', () => {
  it('uint8 overflow under literal conditions', () => reverts('ternary-mobile-literal', '', 'uint16',
    'return (true ? 63 : 255) + (false ? 63 : 255);', []));
  it('uint8 overflow under bool conditions', () => reverts('ternary-mobile-bool', '', 'uint16',
    'bool yes = true; bool no = false; return (yes ? 63 : 255) + (no ? 63 : 255);', []));
  it('a uint8 sum that fits', () => run('ternary-mobile-fits', 'bool c', 'uint16',
    'return (c ? 63 : 255) + (c ? 63 : 255);', [true]));
  it('a literal beside a typed branch', () => run('ternary-mobile-mixed', 'bool c, uint8 x', 'uint16',
    'return (c ? x : 63) + 1;', [true, 200n]));
  it('an int8 sum that fits', () => run('ternary-mobile-signed', 'bool c', 'int16',
    'return (c ? -1 : -100) + (c ? -1 : -28);', [false]));
  it('int8 overflow', () => reverts('ternary-mobile-signed-overflow', 'bool c', 'int16',
    'return (c ? -100 : -1) + (c ? -100 : -1);', [true]));
});
