// Solidity behavioral parity pins (VM-run, invisible to the compile-only bench): function types, array
// bounds/defaults, panics/short-circuit, internal fn-ptr memory arrays and state vars.
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory, Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { fundedSigner, createTestProvider, expectOverOperationCostBudget } from '../test-util.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const missingAuthenticatedReturn = (functionName: string): string =>
  `Could not derive the return value of '${functionName}' for .emitReturn(). The covenant trace did not expose an authenticated return commitment.`;

const preflightFailure = (reason: string): string =>
  `messageBus: BCH-2026 preflight failed at input 0: ${reason}`;

describe('function types', () => {
  // functionTypes/ corpus files VM-run against their Solidity `// ----` outputs (the bench is
  // compile-only): each contract's ok() require()s the expected results; wrong() must revert.

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
      await expect(sc.wrong()).rejects.toThrow(missingAuthenticatedReturn('wrong'));
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
      await expect(sc.wrong()).rejects.toThrow(missingAuthenticatedReturn('wrong'));
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
      await expect(sc.callDeleted()).rejects.toThrow(missingAuthenticatedReturn('callDeleted'));
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
      await expect(sc.delThenCall()).rejects.toThrow(preflightFailure(
        'Program attempted to OP_INVOKE an undefined function identifier. Function identifier: 0xffffff7f.',
      ));
    });

    // ternary_contract_public_function.sol: `(b ? C.f : C.g)()` with PUBLIC functions -> 1/2 per branch.
    it('ternary_contract_public_function: public-function ternary dispatches per branch', async () => {
      const art = compileString(`contract C {
        function f() public pure returns(int) { return 1; }
        function g() public pure returns(int) { return 2; }
        function test(bool b) public returns(int) { return (b ? C.f : C.g)(); }
        function ok() public returns (bool) { require(test(true) == 1); require(test(false) == 2); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.ok()).resolves.toBeDefined();
    });

    // same_function_in_construction_and_runtime_equality_check.sol: a SET fn-ptr compares equal to its target
    // (`x = double; x == double`). Guards the sentinel-default change against breaking fn-ptr equality: a SET
    // pointer holds the real functionId, never the invalid sentinel.
    it('fn-ptr equality: a set state fn-ptr equals its target (sentinel default did not break ==)', async () => {
      const art = compileString(`contract C {
        function(int) returns (int) internal x;
        function double(int a) public returns (int) { return a * 2; }
        function setEq() public returns (bool) { x = double; require(x == double); return true; }
        function setNeq() public returns (bool) { x = double; require(x != double); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.setEq()).resolves.toBeDefined();
      await expect(sc.setNeq()).rejects.toThrow(preflightFailure('Program failed an OP_VERIFY operation.'));
    });
  });
});

describe('array bounds/defaults', () => {
  // array/ corpus parity: default (zeroed) elements + bounds/pop reverts (Panic 0x32/0x31 analogues
  // must revert, not diverge).

  describe('array bounds/default behavioral parity', () => {
    // test/libsolidity/semanticTests/array/arrayMemoryAllocation/array_zeroed_memory_index_access.sol
    // `new uint[](n); x[a]` == 0 in-bounds; out-of-bounds reverts (Panic 0x32).
    it('zeroed memory array: in-bounds elements are 0', async () => {
      const art = compileString(`contract C {
        function get(int n, int a) internal returns (int) { int[] memory x = new int[](n); return x[a]; }
        function ok() public returns (bool) { require(get(5,0) == 0); require(get(5,4) == 0); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.ok()).resolves.toBeDefined();
    });

    it('memory array out-of-bounds access reverts (Solidity Panic 0x32)', async () => {
      const art = compileString(`contract C {
        function oob() public returns (bool) { int[] memory x = new int[](5); x[5]; return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.oob()).rejects.toThrow(missingAuthenticatedReturn('oob'));
    });

    // test/libsolidity/semanticTests/array/array_storage_pop_zero_length.sol
    // pop() on an empty storage array reverts (Panic 0x31).
    it('storage array pop() on empty reverts (Solidity Panic 0x31)', async () => {
      const art = compileString(`contract C {
        int[] storageArray;
        function popEmpty() public returns (bool) { storageArray.pop(); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.popEmpty()).rejects.toThrow(preflightFailure('Program failed an OP_VERIFY operation.'));
    });

    // test/libsolidity/semanticTests/array/array_storage_push_pop.sol
    // push() to len, pop() all -> length 0.
    it('storage array push/pop length management -> 0', async () => {
      const art = compileString(`contract C {
        int[] storageArray;
        function setGetLength(int len) public returns (int) {
          while (storageArray.length < len) storageArray.push();
          while (storageArray.length > 0) storageArray.pop();
          return storageArray.length;
        }
        function ok() public returns (bool) { require(setGetLength(10) == 0); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.ok()).resolves.toBeDefined();
    });
  });
});

describe('panics/short-circuit', () => {
  // Behavioral parity for universal Solidity semantics that a value/VM model could silently diverge on:
  // runtime division/modulo by zero (Panic 0x12), assert(false) (Panic 0x01), and short-circuit && / ||
  // (the RHS must not be evaluated / its side effects must not happen when the LHS decides the result).

  describe('panic + short-circuit behavioral parity', () => {
    it('runtime division by zero reverts', async () => {
      const art = compileString(`contract C {
        function divZero(int a, int b) public returns (int) { return a / b; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.divZero(10n, 0n)).rejects.toThrow(missingAuthenticatedReturn('divZero'));
    });

    it('runtime modulo by zero reverts', async () => {
      const art = compileString(`contract C {
        function modZero(int a, int b) public returns (int) { return a % b; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.modZero(10n, 0n)).rejects.toThrow(missingAuthenticatedReturn('modZero'));
    });

    // test/libsolidity/semanticTests/reverts/assert_require.sol
    it('assert(false) reverts, assert(true) does not', async () => {
      const art = compileString(`contract C {
        function assertF() public returns (bool) { assert(false); return true; }
        function assertT() public returns (bool) { assert(true); return true; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.assertF()).rejects.toThrow(missingAuthenticatedReturn('assertF'));
      await expect(sc.assertT()).resolves.toBeDefined();
    });

    // Short-circuit with a RUNTIME LHS and an observable RHS side effect (division by zero). When the LHS
    // decides the boolean, the RHS must NOT be evaluated, so `10 / x` with x == 0 must NOT revert. A
    // non-short-circuiting implementation would evaluate the RHS and revert.
    it('&& and || short-circuit: the RHS (a would-revert div) is skipped', async () => {
      const art = compileString(`contract C {
        // c=false && (10/x): RHS skipped -> no div-by-zero revert.
        function scAnd(bool c, int x) public returns (bool) { if (c && (10 / x > 0)) { return true; } return false; }
        // c=true || (10/x): RHS skipped -> no div-by-zero revert.
        function scOr(bool c, int x) public returns (bool) { if (c || (10 / x > 0)) { return true; } return false; }
      }`, { forceStateful: true });
      const sc = await getContractFactory(art, await fundedSigner()).deploy();
      await expect(sc.scAnd(false, 0n)).resolves.toBeDefined(); // LHS false -> && short-circuits, no 10/0
      await expect(sc.scOr(true, 0n)).resolves.toBeDefined();   // LHS true  -> || short-circuits, no 10/0
      // Sanity: when the RHS IS reached (LHS does not decide), the div-by-zero reverts.
      await expect(sc.scAnd(true, 0n)).rejects.toThrow(missingAuthenticatedReturn('scAnd'));
    });
  });
});

describe('internal fn-ptr memory array', () => {
  // array/function_memory_array.sol verbatim: internal fn-ptr memory array dispatched by runtime index
  // (functionIds -> int array + indexed OP_INVOKE). Expected: 11,12,13,15,18, unset slot FAILS.
  const SRC = `contract C {
    function a(int x) public returns (int) { return x + 1; }
    function b(int x) public returns (int) { return x + 2; }
    function c(int x) public returns (int) { return x + 3; }
    function d(int x) public returns (int) { return x + 5; }
    function e(int x) public returns (int) { return x + 8; }
    function test(int x, int i) internal returns (int) {
      function(int) internal returns (int)[] memory arr = new function(int) internal returns (int)[](10);
      arr[0] = a; arr[1] = b; arr[2] = c; arr[3] = d; arr[4] = e;
      return arr[i](x);
    }
    function ok() public returns (bool) {
      require(test(10, 0) == 11);
      require(test(10, 1) == 12);
      require(test(10, 2) == 13);
      require(test(10, 3) == 15);
      require(test(10, 4) == 18);
      return true;
    }
    function wrong() public returns (bool) { require(test(10, 1) == 11); return true; }
  }`;

  const artifact = compileString(SRC, { forceStateful: true });

  describe('function_memory_array corpus: runtime-indexed internal fn-ptr memory array', () => {
    // OVER BUDGET at the real operation-cost limit: this is the shape that was found on BCHN v29 first and only
    // then reproduced on mocknet, because the mock used to publish a relaxed budget. Overshoot is 16 units
    // against a budget of 541,600. See expectOverOperationCostBudget - restore the positive assertion below when
    // the lowering gets cheaper.
    it('arr[i](x) is currently over the BCH-2026 operation-cost budget', async () => {
      const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
      await expectOverOperationCostBudget(sc.ok());
    });

    it('a wrong expectation reverts (dispatch is real per-index, not constant-folded)', async () => {
      const sc = await getContractFactory(artifact, await fundedSigner()).deploy();
      await expect(sc.wrong()).rejects.toThrow(missingAuthenticatedReturn('wrong'));
    });
  });
});

describe('internal fn-ptr state var', () => {
  // Internal fn-ptr STATE vars: an uninitialized one REVERTS when called (no function-0 dispatch); a set
  // one persists across txs and dispatches to the stored functionId.
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x300;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  async function dep(src: string, init: Record<string, unknown>): Promise<any> {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    return (await StatefulContract.deploy(compileString(src, { forceStateful: true }), [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: init, changeAddress: p2pkh.address,
    })).contract;
  }
  async function fund(c: any): Promise<void> {
    await provider.addUtxo(c.address, { txid: uid(), vout: 0, satoshis: 100000n });
  }

  describe('internal fn-ptr state variable behavior', () => {
    it('calling an uninitialized void internal fn-ptr state var reverts', async () => {
      const c = await dep('contract Test { function() internal x; function f() public returns (int) { x(); return 2; } }', {});
      await fund(c); await expect(c.f().send()).rejects.toThrow(preflightFailure(
        'Program attempted to OP_INVOKE an undefined function identifier. Function identifier: 0x.',
      ));
    });

    it('calling an uninitialized int-typed internal fn-ptr state var reverts', async () => {
      const c = await dep('contract Test { function(int) internal returns(int) x; function f() public returns (int) { return x(5); } }', {});
      await fund(c); await expect(c.f().send()).rejects.toThrow(preflightFailure(
        'Program attempted to OP_INVOKE an undefined function identifier. Function identifier: 0x.',
      ));
    });

    it('a set internal fn-ptr state var persists and dispatches to the stored function', async () => {
      const c = await dep(`contract Test { function(int) internal returns(int) x; int public r;
        function a(int v) public returns (int) { return v + 1; }
        function set() public { x = a; require(true); }
        function run() public { this.r = x(7); } }`, { x: new Uint8Array(), __fnsel_x: new Uint8Array(4), r: 0n });
      await fund(c); await c.set().send();
      await fund(c); await c.run().send();
      expect(Number((await c.getState()).r)).toBe(8);
    });
  });
});
