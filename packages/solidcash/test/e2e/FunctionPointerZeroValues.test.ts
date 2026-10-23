import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { INVALID_FUNCTION_POINTER_ID } from '@solidcash/utils';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// An unset or deleted function pointer (internal, or external `this.f`; local or state) holds the invalid functionId
// in the compiler and in the SDK's genesis state. Ids count from 0, so a zero of 0 equals the first function: here
// `f`, so a deleted `x` compared equal to `this.f` and calling it ran f instead of reverting.
const SRC = `contract C {
  function() external returns (uint256) x;
  function() internal returns (uint256) y;
  function() internal returns (uint256) z;
  function f() public pure returns (uint256) { return 7; }
  function g() internal pure returns (uint256) { return 9; }
  function setX() public { x = this.f; require(x() == 7); }
  function isF() public { require(x == this.f); }
  function notF() public { require(x != this.f); }
  function isZero() public { function() external returns (uint256) u; require(x == u); }
  function callX() public { require(x() == 7); }
  function clearX() public { delete x; }
  function callY() public { require(y() == 9); }
  function setZ() public { z = g; require(z() == 9); }
  function callZ() public { require(z() == 9); }
  function clearZ() public { delete z; }
}`;

const REVERT = /OP_VERIFY|mandatory-script-verify/;
const INVALID_CALL = /undefined function identifier|mandatory-script-verify/;

interface Call { send: () => Promise<unknown> }
type Name = 'setX' | 'isF' | 'notF' | 'isZero' | 'callX' | 'clearX' | 'callY' | 'setZ' | 'callZ' | 'clearZ';
type Handle = Record<Name, () => Call> & { getState: () => Promise<Record<string, unknown>> };

describe('function-pointer zero values (VM-verified, stateful)', () => {
  it('an unset or deleted pointer equals no function and reverts when called', async () => {
    const factory = getContractFactory(compileString(SRC, { evmCompat: true }), await fundedSigner(16));
    const sc = await factory.deploy() as unknown as Handle;
    const initial = await sc.getState();
    expect([initial.x, initial.y, initial.z]).toEqual(Array(3).fill(INVALID_FUNCTION_POINTER_ID));
    // Never-assigned state pointers: the external one is no function and equals a local zero; both revert on call.
    await sc.notF().send();
    await sc.isZero().send();
    await expect(sc.isF().send()).rejects.toThrow(REVERT);
    await expect(sc.callX().send()).rejects.toThrow(INVALID_CALL);
    await expect(sc.callY().send()).rejects.toThrow(INVALID_CALL);
    // `this.f` is function id 0.
    await sc.setX().send();
    expect((await sc.getState()).x).toBe(0n);
    await sc.isF().send();
    await expect(sc.isZero().send()).rejects.toThrow(REVERT);
    // A deleted external pointer is the zero again: unequal to `this.f`, and calling it reverts.
    await sc.clearX().send();
    expect((await sc.getState()).x).toBe(INVALID_FUNCTION_POINTER_ID);
    await sc.notF().send();
    await sc.isZero().send();
    await expect(sc.isF().send()).rejects.toThrow(REVERT);
    await expect(sc.callX().send()).rejects.toThrow(INVALID_CALL);
    // A deleted internal pointer reverts.
    await sc.setZ().send();
    await sc.callZ().send();
    await sc.clearZ().send();
    await expect(sc.callZ().send()).rejects.toThrow(INVALID_CALL);
  });
});
