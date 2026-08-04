import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A plain `mapping` is NOT enumerable (Solidity parity - mappings are not iterable in Solidity). Only an
// `enumerable mapping(...)` may be iterated. See docs/evm-storage-parity.md.

const contract = (decl: string, loopHeader: string): string => `pragma solidcash >=0.8.0;
contract C() {
  ${decl}
  function f() returns (int) {
    int t = 0;
    ${loopHeader} { t = t + 1; }
    require(t >= 0);
    return t;
  }
}`;

describe('enumerable mapping: iteration is gated behind the enumerable type', () => {
  const plain = 'mapping(bytes20 => int) m;';
  const enumerableDecl = 'enumerable mapping(bytes20 => int) m;';

  it('rejects `for (k, v of this.m.entries)` on a plain mapping', () => {
    expect(() => compileString(contract(plain, 'for (bytes20 k, int v of this.m.entries)'), {}))
      .toThrow(/not enumerable/i);
  });
  it('rejects `for (k in this.m)` on a plain mapping', () => {
    expect(() => compileString(contract(plain, 'for (bytes20 k in this.m)'), {})).toThrow(/not enumerable/i);
  });
  it('rejects `for (v of this.m)` on a plain mapping', () => {
    expect(() => compileString(contract(plain, 'for (int v of this.m)'), {})).toThrow(/not enumerable/i);
  });

  it('allows entries iteration on an enumerable mapping', () => {
    expect(() => compileString(contract(enumerableDecl, 'for (bytes20 k, int v of this.m.entries)'), {}))
      .not.toThrow();
  });
  it('allows key iteration on an enumerable mapping', () => {
    expect(() => compileString(contract(enumerableDecl, 'for (bytes20 k in this.m)'), {})).not.toThrow();
  });

  it('the enumerable flag is surfaced on the collection in the artifact', () => {
    const art = compileString('pragma solidcash >=0.8.0;\ncontract C() {\n  enumerable mapping(bytes20 => int) m;\n'
      + '  function f(bytes20 k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.m[k] = v; }\n}', {});
    const col = art.stateLayout?.collections?.find((c) => c.name === 'm') as { enumerable?: boolean } | undefined;
    expect(col?.enumerable).toBe(true);
  });

  it('a plain mapping is not enumerable', () => {
    const art = compileString('pragma solidcash >=0.8.0;\ncontract C() {\n  mapping(bytes20 => int) m;\n'
      + '  function f(bytes20 k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.m[k] = v; }\n}', {});
    const col = art.stateLayout?.collections?.find((c) => c.name === 'm') as { enumerable?: boolean } | undefined;
    // `col?.x ?? false` reads `false` for a collection that is not published AT ALL, which is the same answer
    // this case wants for "published and not enumerable". The subject is asserted before the flag is read.
    expect(col, 'the collection is not published, so the flag below has no subject').toBeDefined();
    expect(col!.enumerable ?? false).toBe(false);
  });

  it('`enumerable` still works as an ordinary identifier (soft keyword)', () => {
    expect(() => compileString('pragma solidcash >=0.8.0;\ncontract C() {\n'
      + '  function f(int enumerable) { require(enumerable > 0); } }', {})).not.toThrow();
  });
});

// A SORTED (C2) enumerable mapping iterates by trustless linkage completeness. Only VALUES mode is supported:
// the entry commitment stores slot=H(key), not the raw key, so keys/entries cannot be recovered on-chain. Those
// throw a clean codegen error rather than miscompile. See docs/evm-storage-parity.md + docs/deferrals.md.
describe('sorted enumerable mapping: iteration mode support', () => {
  const enumerableDecl = 'enumerable mapping(bytes20 => int) m;';
  it('allows VALUES iteration on a sorted enumerable mapping (linkage completeness)', () => {
    expect(() => compileString(contract(enumerableDecl, 'for (int v of this.m)'), {}))
      .not.toThrow();
  });
  it('allows KEYS iteration with a fixed-width key (caller-supplied, covenant-verified keyToSlot==slot)', () => {
    expect(() => compileString(contract(enumerableDecl, 'for (bytes20 k in this.m)'), {}))
      .not.toThrow();
  });
  it('allows ENTRIES iteration with a fixed-width key', () => {
    expect(() => compileString(contract(enumerableDecl, 'for (bytes20 k, int v of this.m.entries)'), {}))
      .not.toThrow();
  });
  it('allows KEYS/ENTRIES on a sorted mapping with a variable-width (int) key (length-prefixed blob)', () => {
    const intDecl = 'enumerable mapping(int => int) m;';
    expect(() => compileString(contract(intDecl, 'for (int k in this.m)'), {}))
      .not.toThrow();
  });
});
