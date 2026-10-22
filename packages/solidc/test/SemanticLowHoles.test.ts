import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * 2026-07 SEMANTIC LOWs.
 *
 * 1. A read-modify-write lowering (nested array write, nested push, struct-field rebuild through a mapping entry,
 *    storage-slot alias) evaluated each key in the read and again in the write-back, so a key that calls a
 *    state-changing function ran it twice and wrote another entry than it read. The key is now bound to a temp
 *    first: the write compiles to exactly the bytecode of the hand-bound form, so it runs once and stores there.
 * 2. `__base_` names the preserved copy of an overridden function; a source declaration may not use it.
 * 3. A bytesN value converts to an address only through an explicit `address(..)`. Address literals,
 *    LockingBytecode results, ecrecover addresses and unbounded locking bytecode keep converting.
 */

const E = { evmCompat: true };
const bytecode = (source: string, options = {}): string => compileString(source, options).bytecode;

describe('a side-effecting key evaluates once', () => {
  const NATIVE_NEXT = 'int counter; '
    + 'function next() internal returns (int) { this.counter = this.counter + 1; return this.counter - 1; }';
  const NEXT = 'uint256 counter; function next() internal returns (uint256) { counter = counter + 1; return counter - 1; }';

  it('in a nested state array element write', () => {
    const src = (body: string): string => `contract C() { ${NATIVE_NEXT} int[3][] rows;`
      + ` function f(int v) { ${body} require(true); } }`;
    expect(bytecode(src('this.rows[next()][1] = v;')))
      .toBe(bytecode(src('bigint t = next(); this.rows[t][1] = v;')));
  });

  it('in a push onto a nested state array', () => {
    const src = (body: string): string => `contract C() { ${NATIVE_NEXT} int[][] rows;`
      + ` function f(int v) { ${body} require(true); } }`;
    expect(bytecode(src('this.rows[next()].push(v);')))
      .toBe(bytecode(src('bigint t = next(); this.rows[t].push(v);')));
  });

  it('in a nested struct-field write through a mapping entry', () => {
    const src = (body: string): string => 'struct I { uint256 x; uint256 y; } struct O { I i; uint256 z; }'
      + ` contract C { ${NEXT} mapping(uint256 => O) m; function f(uint256 v) external { ${body} require(true); } }`;
    expect(bytecode(src('m[next()].i.x = v;'), E)).toBe(bytecode(src('uint256 t = next(); m[t].i.x = v;'), E));
  });

  it('in an element write of a 2D array mapping value', () => {
    const src = (body: string): string => `contract C { ${NEXT} mapping(uint256 => uint256[2][2]) m;`
      + ` function f(uint256 v) external { ${body} require(true); } }`;
    expect(bytecode(src('m[next()][0][1] = v;'), E)).toBe(bytecode(src('uint256 t = next(); m[t][0][1] = v;'), E));
  });

  it('in the slot of a storage-slot alias used twice', () => {
    const src = (bind: string): string => 'struct Uint256Slot { uint256 value; }'
      + ' library StorageSlot { function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r)'
      + ' { assembly { r.slot := slot } } }'
      + ' contract C { uint256 counter;'
      + ' function nextSlot() internal returns (bytes32) { counter = counter + 1; return bytes32(counter); }'
      + ` function f(uint256 v) external { ${bind} uint256 a = r.value; r.value = a + v; require(true); } }`;
    expect(bytecode(src('Uint256Slot storage r = StorageSlot.getUint256Slot(nextSlot());'), E))
      .toBe(bytecode(src('bytes32 s = nextSlot(); Uint256Slot storage r = StorageSlot.getUint256Slot(s);'), E));
  });
});

describe('the __base_ prefix is reserved', () => {
  const RESERVED = /Identifier '__base_\w*' uses reserved prefix '__base_'/;

  it('refuses a function, a local and a parameter named __base_*', () => {
    expect(() => compileString('contract C() { function __base_A_f() internal { require(true); }'
      + ' function f() { __base_A_f(); require(true); } }')).toThrow(RESERVED);
    expect(() => compileString('contract C() { function f(int v) { int __base_x = v; require(__base_x == v); } }'))
      .toThrow(RESERVED);
    expect(() => compileString('contract C() { function f(int __base_p) { require(__base_p == 1); } }'))
      .toThrow(RESERVED);
  });

  it('refuses a declaration that would stand in for the preserved base copy, and keeps super working', () => {
    const base = 'contract A { function f() public virtual pure returns (uint256) { return 1; } }'
      + ' contract B is A { function f() public override pure returns (uint256) { return super.f() + 1; }';
    expect(() => compileString(`${base} function __base_A_f() internal pure returns (uint256) { return 7; } }`, E))
      .toThrow(RESERVED);
    expect(compileString(`${base} }`, E).contractName).toBe('B');
  });
});

describe('bytesN converts to address only explicitly', () => {
  const src = (params: string, body: string): string => `contract C() { function f(${params}) { ${body} } }`;

  it('refuses the implicit conversion of a bytesN value', () => {
    expect(() => compileString(src('bytes20 h', 'address a = h; require(a == a);')))
      .toThrow(/Type 'bytes20' can not be assigned to variable of type 'address'/);
    expect(() => compileString(src('bytes h', 'address a = hash160(h); require(a == a);')))
      .toThrow(/Type 'bytes20' can not be assigned to variable of type 'address'/);
    expect(() => compileString('contract C() { function g(address a) internal returns (bool) { return a == a; }'
      + ' function f(bytes20 h) { require(g(h)); } }')).toThrow();
  });

  it('compiles the explicit cast and the forms that already are addresses', () => {
    expect(compileString(src('bytes20 h', 'address a = address(h); require(a == a);')).contractName).toBe('C');
    expect(compileString(src('', 'address a = 0x0000000000000000000000000000000000000001; require(a == a);'))
      .contractName).toBe('C');
    expect(compileString(src('bytes20 h', 'address a = new LockingBytecodeP2PKH(h); require(a == a);'))
      .contractName).toBe('C');
    expect(compileString(src('bytes l', 'address a = l; require(a == a);')).contractName).toBe('C');
    expect(compileString('contract C { function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {'
      + ' address a = ecrecover(h, v, r, s); require(a != address(0)); } }', E).contractName).toBe('C');
  });
});
