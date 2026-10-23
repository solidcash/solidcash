import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { asmToScript, encodeIntegerValue, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * Assigning or declaring a bounded integer from a non-literal expression enforces the target type's range.
 * `uint8 x = 200 + 100` (generic `int` arithmetic) previously stored 300, and a `bigint` overflow assigned into
 * `uint256` was never checked; the type checker only range-checked bare integer literals.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

function settleDirect(artifact: Artifact, args: readonly bigint[]): boolean {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const pushes = [...args].reverse().flatMap((arg) => [...encodeDataPush(encodeIntegerValue(arg))]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x61), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...pushes, ...encodeDataPush(redeem)]),
    }],
    outputs: [{ lockingBytecode: Uint8Array.from([0x51]), valueSatoshis: 1_000n }],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 10_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction }) === true;
}

const P = 'pragma solidcash ^0.14.0;';
const compile = (params: string, body: string): Artifact =>
  compileString(`${P} contract C { function f(${params}) ${body} }`, { messageBus: false });

describe('a bounded int declared from a computed expression', () => {
  it('reverts when generic int arithmetic overflows the declared width', () => {
    // `200 + 100` keeps the generic `int` type; storing it in `uint8` must refuse, not store 300.
    const source = compile('', '{ uint8 x = 200 + 100; require(x == 300); }');
    expect(settleDirect(source, [])).toBe(false);
  });

  it('accepts a computed expression inside the declared width', () => {
    const source = compile('', '{ uint8 x = 100 + 100; require(x == 200); }');
    expect(settleDirect(source, [])).toBe(true);
  });
});

describe('a bounded int assigned from a bigint expression', () => {
  it('reverts when a bigint overflows uint256', () => {
    const source = compile('bigint b', '{ uint256 x = b; require(x == b); }');
    expect(settleDirect(source, [1n << 256n])).toBe(false);
    expect(settleDirect(source, [100n])).toBe(true);
  });

  it('reverts when a bigint is negative for a uint target', () => {
    const source = compile('bigint b', '{ uint256 x = b; require(x == b); }');
    expect(settleDirect(source, [-1n])).toBe(false);
  });
});

describe('the internal-helper boundary range-checks its parameters and returns', () => {
  it('reverts when a bigint argument narrows into a uint256 helper parameter', () => {
    const source = `${P} contract C { function clamp(uint256 x) internal pure returns (uint256) { return x; } `
      + 'function f(bigint amount) { uint256 a = clamp(amount); require(a == amount); } }';
    const artifact = compileString(source, { messageBus: false });
    expect(settleDirect(artifact, [100n])).toBe(true);
    expect(settleDirect(artifact, [-100n])).toBe(false);
  });

  it('reverts when a helper return narrows a bigint into a uint256 result', () => {
    const source = `${P} contract C { function get() internal pure returns (uint256) { bigint b = -100; return b; } `
      + 'function f() { uint256 a = get(); require(a == a); } }';
    const artifact = compileString(source, { messageBus: false });
    expect(settleDirect(artifact, [])).toBe(false);
  });
});

describe('a cast to a non-contiguous enum verifies exact membership', () => {
  it('rejects a gap value that a range check would admit', () => {
    const source = `${P} enum E { A, B = 5 } contract C { function f(uint8 v) { E e = E(v); require(e == e); } }`;
    const artifact = compileString(source, { messageBus: false });
    expect(settleDirect(artifact, [0n])).toBe(true);
    expect(settleDirect(artifact, [5n])).toBe(true);
    expect(settleDirect(artifact, [3n])).toBe(false);
  });
});
