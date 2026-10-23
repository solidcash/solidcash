import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { asmToScript, encodeIntegerValue, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * Unsigned numeric semantics are correct on the shipped BCH-2026 machine: a `uint` value whose sign-magnitude top
 * bit is set (for example 200 in a `uint8`) is still read as a positive number, because canonical script numbers
 * carry an explicit sign byte. These tests lock the guards that an audit hypothesis claimed were bypassed, so a
 * regression to signed-only comparisons or a narrower fixed-point range is caught here.
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

describe('unsigned relational comparisons', () => {
  it('refuses a uint8 cap for a top-half value, and admits the value itself', () => {
    const cap = compile('uint8 amount', '{ require(amount <= 100); }');
    expect(settleDirect(cap, [200n])).toBe(false);
    expect(settleDirect(cap, [100n])).toBe(true);
    expect(settleDirect(cap, [128n])).toBe(false);

    const lower = compile('uint8 amount', '{ require(amount >= 0); }');
    expect(settleDirect(lower, [200n])).toBe(true);
    expect(settleDirect(lower, [255n])).toBe(true);
  });

  it('refuses a uint256 cap for a value above 2^255', () => {
    const cap = compile('uint256 amount', '{ require(amount <= 100); }');
    expect(settleDirect(cap, [2n ** 255n + 50n])).toBe(false);
    expect(settleDirect(cap, [50n])).toBe(true);
  });
});

describe('unsigned within/min/max builtins', () => {
  it('admits the full uint8 range and orders top-half values as positive', () => {
    const within = compile('uint8 amount', '{ require(within(amount, 0, 255)); }');
    expect(settleDirect(within, [200n])).toBe(true);
    expect(settleDirect(within, [100n])).toBe(true);

    const min = compile('uint8 amount', '{ require(min(amount, 100) == 100); }');
    expect(settleDirect(min, [200n])).toBe(true);

    const max = compile('uint8 amount', '{ require(max(amount, 100) == 200); }');
    expect(settleDirect(max, [200n])).toBe(true);
    expect(settleDirect(max, [100n])).toBe(false);
  });
});

describe('unsigned fixed-point bounds', () => {
  it('admits the full declared ufixed range and enforces its cap', () => {
    const full = compile('ufixed8x0 amount', '{ require(amount == 255); }');
    expect(settleDirect(full, [255n])).toBe(true);

    const cap = compile('ufixed8x0 amount', '{ require(amount <= 100); }');
    expect(settleDirect(cap, [200n])).toBe(false);
    expect(settleDirect(cap, [100n])).toBe(true);
  });
});
