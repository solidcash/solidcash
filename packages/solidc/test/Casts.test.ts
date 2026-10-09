import { beforeEach, describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// Type casts: bytesN<->bytesM, uint160/bytes20(address), uint256<->int, address casts.

// Vitest can reuse a restored console spy; each warning assertion must see only its own compilation.
beforeEach(() => vi.clearAllMocks());

describe('EVM CREATE2 address compatibility warning', () => {
  const opts = { evmCompat: true };

  it('warns for the canonical pair-address computation through contract and integer casts', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      compileString(`pragma solidity 0.6.12;
        interface IPair {}
        contract C {
          function pairFor(address factory, address token0, address token1, bytes32 pairCodeHash)
            public pure returns (IPair pair) {
            pair = IPair(uint256(keccak256(abi.encodePacked(
              hex"ff", factory, keccak256(abi.encodePacked(token0, token1)), pairCodeHash
            ))));
          }
        }`, opts);
      expect(log.mock.calls.flat().join(' ')).toMatch(
        /EVM CREATE2 address computation.*cannot derive a native BCH contract address/,
      );
      expect(log.mock.calls.flat().join(' ')).toMatch(/CashToken category ID.*factory's registry/);
    } finally {
      log.mockRestore();
    }
  });

  it('does not warn for unrelated packed hashes', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      compileString(`pragma solidity 0.6.12; contract C {
        function hashFour(bytes1 domain, address a, bytes32 b, bytes32 c) public pure returns (bytes32) {
          return keccak256(abi.encodePacked(domain, a, b, c));
        }
        function hashWrongDomain(address a, bytes32 b, bytes32 c) public pure returns (bytes32) {
          return keccak256(abi.encodePacked(hex"fe", a, b, c));
        }
      }`, opts);
      expect(log.mock.calls.flat().join(' ')).not.toMatch(/EVM CREATE2 address computation/);
    } finally {
      log.mockRestore();
    }
  });
});

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
      { messageBus: false },
    );
    expect(a.bytecode).toContain('OP_SPLIT OP_DROP');
  });

  it('widening a bounded bytes right-pads with zero bytes (OP_CAT)', () => {
    const a = compileString(
      'contract C() { function f() { bytes1 a = 0x12; bytes4 b = bytes4(a); require(b.length == 4); } }',
      { messageBus: false },
    );
    expect(a.bytecode).toContain('OP_CAT');
  });
});

describe('uint160(address) / bytes20(address) Solidity-compat narrowing casts', () => {
  it('bytes20(address) narrows to the embedded 20-byte hash (skips the P2PKH frame) and warns', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes20 e) { require(bytes20(a) == e); } }',
      { messageBus: false }).debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP'); // skip the 0x76a914 prefix, then take 20 / drop 88ac
    expect(asm).not.toContain('OP_BIN2NUM');        // bytes20, not int
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(true);
    warn.mockRestore();
  });

  it('uint160(address) narrows then OP_BIN2NUM to a non-negative int', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, int e) { require(uint160(a) == e); } }',
      { messageBus: false }).debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP');
    expect(asm).toContain('OP_BIN2NUM');
    warn.mockRestore();
  });

  it('interprets the address identity as big-endian only in Solidity-compatible numeric casts', () => {
    const source = 'contract C() { function f(address a, uint160 e) { require(uint160(a) == e); } }';
    const native = bytecodeToAsm(hexToBin(compileString(source, { messageBus: false }).debug.bytecode));
    const compatible = bytecodeToAsm(hexToBin(compileString(source, {
      messageBus: false, evmCompat: true,
    }).debug.bytecode));
    const evmCompatible = bytecodeToAsm(hexToBin(compileString(source, {
      messageBus: false, evmCompat: true,
    }).debug.bytecode));
    expect(native).not.toContain('OP_REVERSEBYTES');
    expect(compatible).toContain('OP_REVERSEBYTES');
    expect(compatible).toContain('OP_BIN2NUM');
    expect(evmCompatible).toContain('OP_REVERSEBYTES');
  });

  it('uint160(address) HASH160s a 35-byte P2SH32 instead of the P2PKH offset-3 extract', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, int e) { require(uint160(a) == e); } }',
      { messageBus: false }).debug.bytecode));
    expect(asm).toContain('OP_SIZE 23 OP_EQUAL');
    expect(asm).toContain('OP_HASH160');
    warn.mockRestore();
  });

  it('abi.encodePacked(uint160(address)) publishes the narrowed 20-byte Solidity identity', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a) returns (bytes) { return abi.encodePacked(uint160(a)); } }',
      { evmCompat: true, messageBus: false }).debug.bytecode));
    expect(asm).toContain('OP_3 OP_SPLIT OP_NIP');
    expect(asm).toContain('OP_BIN2NUM');
    expect(asm).toContain('OP_REVERSEBYTES');
    warn.mockRestore();
  });

  it("addressForm: 'bytecode' changes no cast: uint160(a) and bytes20(a) still truncate", () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const source = 'contract C() { function f(address a, bytes20 e) returns (bytes) '
      + '{ return abi.encodePacked(bytes20(a), uint160(a)); } }';
    for (const form of ['hash', 'bytecode'] as const) {
      const asm = bytecodeToAsm(hexToBin(compileString(source, {
        evmCompat: true, messageBus: false, addressForm: form,
      }).debug.bytecode));
      // The narrowing script belongs to the cast, and the cast emits it in either form.
      expect(asm).toContain('OP_3 OP_SPLIT OP_NIP');
      expect(asm).toContain('OP_HASH160');
    }
    expect(warn.mock.calls.some((c) => String(c[0]).includes('narrows a variable-length BCH address'))).toBe(true);
    warn.mockRestore();
  });

  it("addressForm: 'hash' is assertable natively too, so the identity is the caller's choice either way", () => {
    const source = 'contract C() { function f(address a) returns (bytes) { return abi.encodePacked(a); } }';
    const native = bytecodeToAsm(hexToBin(compileString(source, { messageBus: false }).debug.bytecode));
    const forced = bytecodeToAsm(hexToBin(compileString(source, {
      messageBus: false, addressForm: 'hash',
    }).debug.bytecode));
    // A native compile packs the lock by default; asking for 'hash' inserts the identity narrowing.
    expect(native).not.toContain('OP_3 OP_SPLIT OP_NIP');
    expect(forced).toContain('OP_3 OP_SPLIT OP_NIP');
  });

  it("addressForm: 'bytecode' packs the whole lock where 'hash' packs the 20-byte identity", () => {
    const source = 'contract C() { function f(address a) returns (bytes) '
      + '{ return abi.encodePacked(a); } }';
    const hash = bytecodeToAsm(hexToBin(compileString(source, {
      evmCompat: true, messageBus: false, addressForm: 'hash',
    }).debug.bytecode));
    const bytecode = bytecodeToAsm(hexToBin(compileString(source, {
      evmCompat: true, messageBus: false, addressForm: 'bytecode',
    }).debug.bytecode));
    expect(hash).toContain('OP_3 OP_SPLIT OP_NIP');
    expect(bytecode).not.toContain('OP_3 OP_SPLIT OP_NIP');
    expect(bytecode.length).toBeLessThan(hash.length);
  });

  it('bytes(address) keeps the full locking bytecode (only bytes20/int narrow)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(address a, bytes e) { require(bytes(a) == e); } }',
      { messageBus: false }).debug.bytecode));
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
