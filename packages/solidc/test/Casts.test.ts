import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// Type casts: bytesN<->bytesM, uint160/bytes20(address), uint256<->int, address casts.

describe('uint256 <-> int compatibility', () => {
  it.each([
    ['state assign', 'contract C() { uint256 x; function f() { this.x = 5; } }'],
    ['return int as uint256', 'contract C() { int n; function f() returns (uint256) { this.n = 1; return 7; } }'],
    ['local uint256 -> bigint', 'contract C() { bigint n; function f() { uint256 y = 3; this.n = y; } }'],
  ])('%s', (_l, src) => {
    expect(compileString(src).contractName).toBe('C');
  });
});

describe('address casts + enum state + unresolved-type params', () => {
  it('allows the explicit address(int) cast (e.g. address(0))', () => {
    const a = compileString('contract C() { address a; function f() { this.a = address(0); } }');
    expect(a.contractName).toBe('C');
  });

  it('allows a bytes address literal to initialize an address', () => {
    const a = compileString('contract C() { address a = 0x0000000000000000000000000000000000000001; function f() { this.a = address(0); } }');
    expect(a.contractName).toBe('C');
  });

  it('allows an enum-typed state variable', () => {
    const a = compileString('contract C() { enum S { A, B } S status; function f() { this.status = S.B; } }');
    expect(a.contractName).toBe('C');
  });

  it('does not crash on a contract/interface-typed parameter (resolves to address)', () => {
    const a = compileString('interface ICallee { function setX(int x) external; } contract C() { int n; function f(ICallee c) { require(c != address(0)); this.n = 1; } }');
    expect(a.contractName).toBe('C');
  });
});

describe('SBE-2: bytesN -> bytesM cast (truncate / widen)', () => {
  it('compiles bytes4(keccak256(...)) function-selector truncation', () => {
    const a = compileString(`
      contract C() {
        function f(string s) {
          bytes4 sel = bytes4(keccak256(bytes(s)));
          require(sel.length == 4);
        }
      }`);
    expect(a.contractName).toBe('C');
  });

  it('shrinking a bounded bytes truncates the leftmost bytes (OP_SPLIT OP_DROP)', () => {
    const a = compileString(
      'contract C() { function f() { bytes2 a = 0x1234; bytes1 b = bytes1(a); require(b.length == 1); } }',
      { hiddenBatch: false },
    );
    expect(a.bytecode).toContain('OP_SPLIT OP_DROP');
  });

  it('widening a bounded bytes right-pads with zero bytes (OP_CAT)', () => {
    const a = compileString(
      'contract C() { function f() { bytes1 a = 0x12; bytes4 b = bytes4(a); require(b.length == 4); } }',
      { hiddenBatch: false },
    );
    expect(a.bytecode).toContain('OP_CAT');
  });
});

describe('uint160(address) / bytes20(address) Solidity-compat narrowing casts', () => {
  it('bytes20(address) narrows to the embedded 20-byte hash (skips the P2PKH frame) and warns', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes20 e) { require(bytes20(a) == e); } }',
      { hiddenBatch: false }).debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP'); // skip the 0x76a914 prefix, then take 20 / drop 88ac
    expect(asm).not.toContain('OP_BIN2NUM');        // bytes20, not int
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(true);
    warn.mockRestore();
  });

  it('uint160(address) narrows then OP_BIN2NUM to a non-negative int', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, int e) { require(uint160(a) == e); } }',
      { hiddenBatch: false }).debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP');
    expect(asm).toContain('OP_BIN2NUM');
    warn.mockRestore();
  });

  it('bytes(address) keeps the full locking bytecode (only bytes20/int narrow)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes e) { require(bytes(a) == e); } }',
      { hiddenBatch: false }).debug.bytecode));
    expect(asm).not.toContain('OP_3 OP_SPLIT OP_NIP');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(false);
    warn.mockRestore();
  });

  it('address(bytes20) / address(uint160) warn (a BCH address is variable-length, not a 20-byte hash)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes20 b) { address x = address(b); require(x == x); } }');
    compileString('contract C() { function f(int i) { address x = address(uint160(i)); require(x == x); } }');
    const fired = warn.mock.calls.filter((c) => String(c[0]).includes('does not yield a valid'));
    expect(fired.length).toBe(2);
    warn.mockRestore();
  });

  it('address(bytes) (a full locking bytecode) does NOT warn', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes b) { address x = address(b); require(x == x); } }');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('does not yield a valid'))).toBe(false);
    warn.mockRestore();
  });
});
