import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Function modifiers: the `_;` placeholder and modifier / custom-modifier interleaving.

// The modifier placeholder `_;` may live inside an if/else branch (or loop body), not only at the modifier
// body top level - the OZ `ifAdmin` proxy pattern. Grammar allows it anywhere a statement is; modifier
// expansion counts + replaces it recursively.
describe('`_;` modifier placeholder inside a conditional', () => {
  it('expands `_;` nested in an if/else branch', () => {
    const a = compileString(
      'contract C { int x; modifier ifZero() { if (this.x == 0) { _; } else { require(false); } }'
      + ' function f() ifZero { this.x = 1; } }',
      { solidityImportCompat: true },
    );
    expect(a.contractName).toBe('C');
  });
});

describe('function modifier / custom-modifier interleaving (Solidity allows any order)', () => {
  const cc = (src: string): string => compileString(src, { solidityImportCompat: true }).contractName;
  it('accepts a custom modifier invocation BEFORE visibility (function f() M(1) public {})', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() M(1) public { require(true); } }')).toBe('C');
  });
  it('accepts multiple custom modifiers interleaved with visibility/mutability', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier A{_;} modifier B{_;}'
      + ' function f() A public B view { require(true); } }')).toBe('C');
  });
  it('still accepts the visibility-first order', () => {
    expect(cc('pragma solidity ^0.8.0; contract C { modifier M(uint i){_;}'
      + ' function f() public M(1) { require(true); } }')).toBe('C');
  });
});
