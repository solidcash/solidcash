import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import { asmToScript, encodePushdataValue, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

/**
 * The deferred calldata `.offset` tail and `calldata_array_read` shapes. `x.offset` of a dynamic param that is NOT
 * the first resolves to the REAL ABI tail position (head + cumulative runtime length of the preceding dynamic
 * params), and a nested calldata fixed-array element (`uint256[2] calldata t = x[1]; s := t`) reads its real ABI
 * offset while the high-level element values decode correctly.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

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

const OPTS = { evmCompat: true, messageBus: false };

describe('calldata .offset tail for a non-first dynamic param', () => {
  // head = selector(4) + a.offset word(32) + b.offset word(32) = 68; a's tail = 32 + roundUp32(a.length); b's own
  // length word = 32. b.offset = 68 + 32 + 32 + roundUp32(a.length) = 132 + roundUp32(a.length).
  const source = 'contract C { function f(bytes a, bytes b) external pure {'
    + ' uint o; assembly { o := b.offset }'
    + ' require(o == 132 + ((a.length + 31) / 32) * 32);'
    + ' } }';
  const artifact = compileString(source, OPTS);

  it('resolves the offset to the real tail position for a short and a multi-word first param', () => {
    expect(settleDirect(artifact, [Uint8Array.from([1, 2, 3, 4, 5]), Uint8Array.from([9])]), 'len 5').toBe(true);
    expect(settleDirect(artifact, [Uint8Array.from(new Array(70).fill(7)), Uint8Array.from([9])]), 'len 70').toBe(true);
  });

  it('rejects a stale head-only offset (the old fake model)', () => {
    const wrong = compileString('contract C { function f(bytes a, bytes b) external pure {'
      + ' uint o; assembly { o := b.offset } require(o == 132); } }', OPTS);
    expect(settleDirect(wrong, [Uint8Array.from([1, 2, 3, 4, 5]), Uint8Array.from([9])])).toBe(false);
  });
});

describe('nested calldata fixed-array element read (calldata_array_read)', () => {
  // x is the SECOND dynamic param, so its data offset depends on a's runtime length. t = x[1] points at row 1;
  // `s := t` reads that real offset as a word (o + 1 row * 2 words * 32 bytes), and t[0]/t[1] decode the values.
  const source = 'contract C { function f(bytes a, uint256[2][] calldata x) external pure {'
    + ' uint o; uint s; uint256[2] calldata t = x[1];'
    + ' assembly { o := x.offset s := t }'
    + ' require(o == 132 + ((a.length + 31) / 32) * 32);'
    + ' require(s == o + 64);'
    + ' require(t[0] == 3);'
    + ' require(t[1] == 4);'
    + ' } }';
  const artifact = compileString(source, OPTS);
  const x = encodePushdataValue([[1n, 2n], [3n, 4n]], 'uint256[2][]');

  it('decodes the correct element offset and values together', () => {
    expect(settleDirect(artifact, [Uint8Array.from([1, 2, 3, 4, 5]), x])).toBe(true);
    expect(settleDirect(artifact, [Uint8Array.from(new Array(70).fill(7)), x])).toBe(true);
  });

  it('refuses a wrong element value, proving the read is not a fake offset', () => {
    const wrong = compileString('contract C { function f(bytes a, uint256[2][] calldata x) external pure {'
      + ' uint o; uint s; uint256[2] calldata t = x[1];'
      + ' assembly { o := x.offset s := t }'
      + ' require(s == o + 64);'
      + ' require(t[0] == 3);'
      + ' require(t[1] == 5);'
      + ' } }', OPTS);
    expect(settleDirect(wrong, [Uint8Array.from([1, 2, 3, 4, 5]), x])).toBe(false);
  });
});

