import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Behavioral parity for universal Solidity semantics that a value/VM model could silently diverge on:
// runtime division/modulo by zero (Panic 0x12), assert(false) (Panic 0x01), and short-circuit && / ||
// (the RHS must not be evaluated / its side effects must not happen when the LHS decides the result).

describe('panic + short-circuit behavioral parity', () => {
  it('runtime division by zero reverts', async () => {
    const art = compileString(`contract C {
      function divZero(int a, int b) public returns (int) { return a / b; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.divZero(10n, 0n)).rejects.toThrow();
  });

  it('runtime modulo by zero reverts', async () => {
    const art = compileString(`contract C {
      function modZero(int a, int b) public returns (int) { return a % b; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.modZero(10n, 0n)).rejects.toThrow();
  });

  it('assert(false) reverts, assert(true) does not', async () => {
    const art = compileString(`contract C {
      function assertF() public returns (bool) { assert(false); return true; }
      function assertT() public returns (bool) { assert(true); return true; }
    }`, { forceStateful: true });
    const sc = await getContractFactory(art, await fundedSigner()).deploy();
    await expect(sc.assertF()).rejects.toThrow();
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
    await expect(sc.scAnd(true, 0n)).rejects.toThrow();
  });
});
