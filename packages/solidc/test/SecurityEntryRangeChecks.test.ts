import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { asmToScript, encodeIntAsFixedBytes, encodePushdataValue, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * A negative or out-of-range VM number inside a `uint` array or struct parameter is refused before it reaches the
 * contract body. Scalar entry parameters are range-checked by the H6 entry enforcement, but array elements and
 * struct fields were decoded with OP_BIN2NUM with no range check, so a caller could pass a negative value inside a
 * `uint[]`/`uint[N]`/packed array and defeat an accounting guard such as `shares -= amounts[0]`.
 *
 * Each malicious argument below is built from the same fixed-width sign-magnitude helper the shipped encoder
 * produces, so the bytes are what a real spend would carry - not a test-only shortcut.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** Verifies a direct spend of the single entry of a stateless contract with `args` in parameter order. */
function settleDirect(artifact: Artifact, args: readonly Uint8Array[]): boolean {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const pushes = [...args].reverse().flatMap((arg) => [...encodeDataPush(arg)]);
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
const compile = (members: string): Artifact => compileString(`${P} contract C { ${members} }`, { messageBus: false });

/** A `count ++ tight-elements` array blob for a fixed-width numeric element type. */
function arrayBlob(count: number, elementWidth: number, ...elements: bigint[]): Uint8Array {
  const prefix = encodePushdataValue(BigInt(count), 'bigint');
  const body = new Uint8Array(elements.length * elementWidth);
  elements.forEach((value, index) => body.set(encodeIntAsFixedBytes(value, elementWidth), index * elementWidth));
  const result = new Uint8Array(prefix.length + body.length);
  result.set(prefix, 0);
  result.set(body, prefix.length);
  return result;
}

/** A pushdata-framed struct field value (what `emitGenericPushdataDecode` reads). */
function framed(value: bigint): Uint8Array {
  return Uint8Array.from(encodeDataPush(bigIntToVmNumber(value)));
}

describe('an out-of-range element in a numeric array parameter', () => {
  it('refuses a negative uint[] element before a guard that would accept it', () => {
    // The body only accepts a negative element (`amounts[0] < 0`), so a refusal proves the decode itself reverted.
    const source = compile('function f(uint[] amounts) { require(amounts[0] < 0); }');
    const negative = arrayBlob(1, 33, -100n);
    expect(settleDirect(source, [negative])).toBe(false);
  });

  it('accepts an in-range uint[] element', () => {
    const source = compile('function f(uint[] amounts) { require(amounts[0] == 100); }');
    expect(settleDirect(source, [arrayBlob(1, 33, 100n)])).toBe(true);
    expect(settleDirect(source, [arrayBlob(1, 33, -100n)])).toBe(false);
  });

  it('refuses a negative uint8[] element before a guard that would accept it', () => {
    const source = compile('function f(uint8[] amounts) { require(amounts[0] < 0); }');
    expect(settleDirect(source, [arrayBlob(1, 2, -1n)])).toBe(false);
  });

  it('accepts the full uint8 range, including the top half', () => {
    const source = compile('function f(uint8[] amounts) { require(amounts[0] == 200); }');
    expect(settleDirect(source, [arrayBlob(1, 2, 200n)])).toBe(true);
    expect(settleDirect(source, [arrayBlob(1, 2, 0n)])).toBe(false);
  });

  it('refuses an out-of-range element that wraps a bounded int', () => {
    // -1 does not fit uint8; the fixed-width bytes read back as a negative VM number and must be refused.
    const source = compile('function f(uint8[] amounts) { require(amounts[0] < 0); }');
    expect(settleDirect(source, [arrayBlob(1, 2, -1n)])).toBe(false);
  });
});

describe('an out-of-range numeric struct field', () => {
  it('refuses a negative uint struct field before a guard that would accept it', () => {
    const source = compile('struct P { uint amount; } function f(P p) { require(p.amount < 0); }');
    expect(settleDirect(source, [framed(-100n)])).toBe(false);
  });

  it('accepts an in-range uint struct field', () => {
    const source = compile('struct P { uint amount; } function f(P p) { require(p.amount == 100); }');
    expect(settleDirect(source, [framed(100n)])).toBe(true);
    expect(settleDirect(source, [framed(-100n)])).toBe(false);
  });
});
