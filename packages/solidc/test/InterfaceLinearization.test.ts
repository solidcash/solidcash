import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// solc linearizes interfaces together with contracts and refuses a hierarchy with no C3 linearization (TypeError 5005).
const compile = (body: string): unknown => compileString(`
pragma solidity ^0.8.0;
interface ParentA {}
interface ParentB {}
interface Sub is ParentA, ParentB {}
${body}`, { evmCompat: true });

describe('C3 linearization across interfaces', () => {
  it('refuses a base listed after an interface that already derives from it', () => {
    expect(() => compile('contract C is Sub, ParentA { function f() public pure returns (uint256) { return 1; } }'))
      .toThrow('cannot compute a C3 linearization');
  });

  it('accepts the same bases listed most-base-first', () => {
    expect(() => compile('contract C is ParentA, Sub { function f() public pure returns (uint256) { return 1; } }'))
      .not.toThrow();
  });
});
