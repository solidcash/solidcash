import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// solc TypeError 3464 (syntaxTests/controlFlow/{storageReturn,calldataReturn,uninitializedAccess}): a storage or
// calldata pointer must be assigned on every normally returning path before it is returned or read.
const compile = (members: string): string => compileString(
  `contract C { struct S { bool f; } S s; uint[] a; ${members} }`,
  { evmCompat: true },
).contractName;
const RETURNED = /storage pointer type and can be returned without prior assignment/;
const ACCESSED = /storage pointer type and can be accessed without prior assignment/;

describe('pointer return assignment (solc TypeError 3464)', () => {
  it('rejects a storage return left unassigned on some normally returning path', () => {
    for (const members of [
      'function f(bool b) internal view returns (S storage c) { if (b) c = s; }',
      'function f() internal view returns (S storage c) { while (false) { c = s; } }',
      'function f() internal view returns (S storage c) { for (;; c = s) {} }',
      'function f() internal view returns (S storage c) { do { break; c = s; } while (false); }',
      'function f() internal view returns (S storage c) { do { if (s.f) continue; c = s; } while (false); }',
      'function f() internal view returns (S storage c) { false && (c = s).f; }',
      'function f(bool b) internal view returns (S storage c) { b ? (c = s).f : false; }',
      'function f() internal pure returns (S storage) { assembly {} }',
      'function f(uint k) internal pure returns (S storage c) { assembly { switch k case 0 { c.slot := s.slot } } }',
      'modifier only(bool b) { if (b) _; } function f(bool b) only(b) internal view returns (S storage) { return s; }',
      'function f() internal pure returns (mapping(uint => uint) storage r) {}',
    ]) expect(() => compile(members), members).toThrow(RETURNED);
  });

  it('rejects an unassigned calldata return', () => {
    expect(() => compile('function f() internal pure returns (uint[] calldata) {}'))
      .toThrow(/calldata pointer type and can be returned without prior assignment/);
  });

  it('rejects a pointer read before it is assigned', () => {
    for (const members of [
      'function f() internal returns (uint[] storage r) { r[0] = 0; r = a; }',
      'function f() internal returns (S storage r) { r.f = true; r = s; }',
      'function f() internal view returns (uint[] storage r) { assembly { pop(r.slot) } r = a; }',
      'modifier m(uint[] storage x) { _; } function f() m(r) internal returns (uint[] storage r) { r = a; }',
      'function ext() external {} function f() internal { S storage p; try this.ext() {} catch (bytes memory) { p = s; } p; }',
    ]) expect(() => compile(members), members).toThrow(ACCESSED);
  });

  it('accepts pointers assigned on every normally returning path', () => {
    for (const members of [
      'function f(bool b) internal view returns (S storage c) { if (b) c = s; else revert(); }',
      'function f() internal view returns (S storage c) { do {} while ((c = s).f); }',
      'function f() internal view returns (S storage c) { (c = s).f || true; }',
      'function f() internal view returns (S storage c) { for (; (c = s).f;) {} }',
      'function f(uint k) internal pure returns (S storage c) { assembly { switch k case 0 { revert(0, 0) } default { c.slot := s.slot } } }',
      'modifier always() { _; revert(); } function f(bool b) always internal view returns (S storage) { if (b) return s; }',
      'function f() internal view returns (uint[] storage r) { uint x = r[0]; revert(); x; }',
      'function f() internal pure returns (S memory c) {}',
    ]) expect(compile(members), members).toBe('C');
  });
});
