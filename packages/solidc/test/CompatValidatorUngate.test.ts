import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// Native (no compatibility flag) pins for the validators that were previously gated behind
// evmCompat and now run on every compile. The shipped compiler entry (`src/index.js`) drives each
// case; no dist import and no re-implementation.

const compile = (src: string): ReturnType<typeof compileString> =>
  compileString(src, { messageBus: false, enforceFinalRequire: false });

describe('native validator enforcement (Tier 2)', () => {
  it('T2-1 rejects a derived contract calling an ancestor private function', () => {
    const src = 'contract A() { function f() private {} }'
      + ' contract B() is A { function g() { f(); } }';
    expect(() => compile(src)).toThrow(/Undefined reference to symbol f/);
  });

  it('T2-2 rejects instantiating an abstract contract', () => {
    const src = 'abstract contract A { function f() external; }'
      + ' contract B() { function g() { A a = new A(); } }';
    expect(() => compile(src)).toThrow(/Cannot instantiate abstract contract 'A'/);
  });

  it('T2-3 rejects an unknown user type nested in a struct', () => {
    const src = 'contract C() { struct Nested { Non y; } int x; function f() { this.x = 1; } }';
    expect(() => compile(src)).toThrow(/Unknown contract or interface type 'Non'/);
  });

  it('T2-4 rejects a library calling its own public function externally', () => {
    const src = 'library L1 { using L1 for *;'
      + ' function f() public pure returns (int r) { return r.g(); }'
      + ' function g(int) public pure returns (int) { return 2; } }'
      + ' library L2 { using L1 for *;'
      + ' function f() public pure returns (int r) { return r.g(); }'
      + ' function g(int) public pure returns (int) { return 2; } }';
    expect(() => compile(src)).toThrow(/Library cannot call its own function 'L1\.g' externally/);
  });

  it('T2-5 treats an explicit selfdestruct modifier as implying stateful', () => {
    const src = 'contract C() { function f() selfdestruct { require(true); } }';
    expect(compile(src).contractName).toBe('C');
  });
});
