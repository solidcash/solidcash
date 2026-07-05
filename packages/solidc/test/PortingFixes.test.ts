import { describe, it, expect, vi } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../src/index.js';

// Compiler features surfaced by porting Solidity (Sablier) to SolidCash.
// See packages/solidc/docs/solidity-import-compat.md.

// Foundation for the EVM-parity external-call model. See docs/external-contract-calls.md.
describe('this.categoryId introspection (contract self-category)', () => {
  it('lowers to OP_INPUTINDEX OP_UTXOTOKENCATEGORY (the active input own category)', () => {
    const a = compileString('contract C() { function f(bytes32 expected) { require(this.categoryId == expected); } }');
    expect(a.bytecode).toContain('OP_INPUTINDEX OP_UTXOTOKENCATEGORY');
  });

  it('can be stored into a state variable', () => {
    const a = compileString('contract C() { bytes category; function f() { this.category = this.categoryId; } }');
    expect(a.contractName).toBe('C');
  });

  it('reserves `categoryId` as a state-variable name (shadowed by the introspection token)', () => {
    expect(() => compileString('contract C() { int categoryId; function f() { this.categoryId = 1; } }')).toThrow();
  });
});

describe('SBE-12: single-type abi.decode unwraps to the element type (not a 1-tuple)', () => {
  it('uses a single-type decode in a boolean expression', () => {
    const a = compileString(
      'contract C() { int n; function f(bytes data, bool a) { if (a || abi.decode(data, (bool))) { this.n = 1; } } }',
    );
    expect(a.contractName).toBe('C');
  });
  it('assigns a single-type decode directly', () => {
    const a = compileString('contract C() { bool z; function f(bytes data) { this.z = abi.decode(data, (bool)); } }');
    expect(a.contractName).toBe('C');
  });
});

describe('ecrecover (verify-with-pubkey; no native recovery on BCH)', () => {
  it('3-arg ecrecover(hash, sig, pubKey) emits OP_CHECKDATASIG + the P2PKH build', () => {
    const asm = bytecodeToAsm(hexToBin(compileString(
      'contract C() { function f(bytes32 h, datasig s, pubkey pk) {'
      + ' address r = ecrecover(h, s, pk); require(r != 0x); } }').debug.bytecode));
    expect(asm).toContain('OP_CHECKDATASIG');
    expect(asm).toContain('OP_HASH160');                 // hash160(pubKey) for the P2PKH script
    expect(asm).toContain('76a914');                     // P2PKH prefix
    expect(asm).toContain('88ac');                       // P2PKH suffix
  });

  it('4-arg Solidity ecrecover(hash, v, r, s) compiles (no error), warns, and is inert (drops args -> 0x)', () => {
    const warn = vi.spyOn(console, 'log').mockImplementation(() => {});
    const artifact = compileString(
      'contract C() { function f(bytes32 h, int v, bytes32 r, bytes32 s) {'
      + ' address a = ecrecover(h, v, r, s); require(a == 0x); } }');
    expect(artifact.contractName).toBe('C');             // accepted, not a compile error
    const asm = bytecodeToAsm(hexToBin(artifact.debug.bytecode));
    expect(asm).toContain('OP_2DROP');                   // the (hash, v, r, s) args are dropped
    expect(asm).not.toContain('OP_CHECKDATASIG');        // no verification - inert
    expect(warn.mock.calls.some((c) => String(c[0]).includes('ecrecover(hash, v, r, s)'))).toBe(true);
    warn.mockRestore();
  });
});

describe('calldata read-only enforcement (Solidity data-location parity)', () => {
  const compiles = (body: string): string => compileString(`contract C() { ${body} }`).contractName;
  const REASON = /read-only 'calldata'/;

  it('rejects a direct write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x = 5; require(true); }')).toThrow(REASON);
  });

  it('rejects a compound write to a calldata parameter', () => {
    expect(() => compiles('function f(int calldata x) { x += 1; require(true); }')).toThrow(REASON);
  });

  it('rejects writing a calldata array element', () => {
    expect(() => compiles('function f(int[] calldata xs) { xs[0] = 5; require(true); }')).toThrow(REASON);
  });

  it('allows reading a calldata parameter', () => {
    expect(compiles('function f(int calldata x) { require(x > 0); }')).toBe('C');
  });

  it('allows copying calldata into a plain variable and mutating the copy', () => {
    expect(compiles('function f(int calldata x) { int y = x; y = 5; require(y == 5); }')).toBe('C');
  });

  it('keeps memory parameters mutable (memory is the default, not read-only)', () => {
    expect(compiles('function f(int memory x) { x = 5; require(x == 5); }')).toBe('C');
  });

  it('no longer warns that memory / calldata are no-ops', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    compileString('contract C() { function f(bytes memory a, int calldata b)'
      + ' { require(b > 0); require(a.length > 0); } }');
    const noop = spy.mock.calls.some((c) => String(c[0]).includes('data location modifier is a no-op'));
    spy.mockRestore();
    expect(noop).toBe(false);
  });
});

describe('internal helpers that read a state entry (inlined, not subroutined)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;

  it('inlines a void private helper with a compound mapping write (_mint pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 totalSupply;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; totalSupply += amt; }'
      + ' function mint(address to, uint256 amt) external { _mint(to, amt); require(true); } }')).toBe('C');
  });

  it('inlines a void private helper that reads a mapping then writes', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _m(address k, uint256 v) private { uint256 old = bal[k]; bal[k] = old + v; }'
      + ' function f(address k, uint256 v) external { _m(k, v); require(true); } }')).toBe('C');
  });

  it('leaves a simple-write private helper (no entry read) compiling as before', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal;'
      + ' function _set(address k, uint256 v) private { bal[k] = v; }'
      + ' function f(address k, uint256 v) external { _set(k, v); require(true); } }')).toBe('C');
  });

  it('inlines an entry-reading helper called from the CONSTRUCTOR (the _mint-in-ctor pattern)', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { mapping(address => uint256) bal; uint256 total;'
      + ' function _mint(address to, uint256 amt) private { bal[to] += amt; total += amt; }'
      + ' constructor() { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });

  it('inlines an inherited entry-reading helper called from a child constructor', () => {
    expect(cc('pragma solidity ^0.8.0; contract Base { mapping(address => uint256) bal;'
      + ' constructor(uint256 x) {} function _mint(address to, uint256 amt) internal { bal[to] += amt; } }'
      + ' contract C is Base { constructor() Base(1) { _mint(msg.sender, 100); } function f() external { require(true); } }')).toBe('C');
  });
});
