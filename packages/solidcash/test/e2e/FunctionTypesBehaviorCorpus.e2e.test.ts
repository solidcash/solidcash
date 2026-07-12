import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Behavioral verification of compiling functionTypes/ corpus files against their Solidity `// ----` expected
// outputs (the corpus bench is compile-only; this checks the RESULTS match, catching silent miscompiles).
// int used for uint (small non-negative values -> no int/uint divergence). Each contract exposes an on-chain
// ok() that require()s the corpus-expected results, and (where meaningful) a wrong() that must revert.

describe('functionTypes corpus behavioral parity', () => {
  // pass_function_types_internally.sol: f(7) -> 8 (eval(g,7) == g(7) == 7+1).
  it('pass_function_types_internally: internal fn-ptr passed to a helper dispatches', async () => {
    const art = compileString(`contract C {
      function f(int x) public returns (int) { return eval(g, x); }
      function eval(function(int) internal returns (int) x, int a) internal returns (int) { return x(a); }
      function g(int x) public returns (int) { return x + 1; }
      function ok() public returns (bool) { require(f(7) == 8); return true; }
      function wrong() public returns (bool) { require(f(7) == 9); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
    await expect(sc.wrong()).rejects.toThrow();
  });

  // ternary_contract_internal_function.sol: test(true) -> 1, test(false) -> 2 via `(b ? C.f : C.g)()`.
  it('ternary_contract_internal_function: qualified C.f/C.g ternary dispatches per branch', async () => {
    const art = compileString(`contract C {
      function f() internal pure returns(int) { return 1; }
      function g() internal pure returns(int) { return 2; }
      function test(bool b) public returns(int) { return (b ? C.f : C.g)(); }
      function ok() public returns (bool) { require(test(true) == 1); require(test(false) == 2); return true; }
      function wrong() public returns (bool) { require(test(true) == 2); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.ok()).resolves.toBeDefined();
    await expect(sc.wrong()).rejects.toThrow();
  });

  // function_delete_stack.sol: `function() y = a; delete y; y();` -> FAILURE (calling a nulled pointer reverts).
  // The Solidity-correct behavior is a REVERT; returning 7 would be a silent miscompile (delete didn't null).
  it('function_delete_stack: calling a deleted fn-ptr reverts (matches Solidity FAILURE)', async () => {
    const art = compileString(`contract C {
      function a() public returns (int) { return 7; }
      function callDeleted() public returns (bool) {
        function() returns (int) y = a;
        delete y;
        y();
        return true;
      }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.callDeleted()).rejects.toThrow();
  });

  // function_delete_storage.sol: `delete y` on a STATE fn-ptr writes the invalid sentinel; a later `y()` reverts.
  // Exercised inline (write a, delete, call) to keep the state-delete path in one tx.
  it('function_delete_storage: a deleted state fn-ptr reverts on call', async () => {
    const art = compileString(`contract C {
      function() returns (int) internal y;
      function a() public returns (int) { return 7; }
      function delThenCall() public returns (bool) { y = a; delete y; y(); require(true); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.delThenCall()).rejects.toThrow();
  });
});
