import type { AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { Op, sha256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { extractHashedReturnCommitmentAtOutput } from '../../src/stateful/hashed-return-probe.js';

const value = new Uint8Array(160).fill(0x23);
const snapshot = (): AuthenticationProgramStateCommon => ({
  ip: 4, controlStack: [], stack: [value, sha256(value), Uint8Array.of(7)],
  instructions: [
    Op.OP_DUP, Op.OP_SHA256, Op.OP_2, Op.OP_PICK, Op.OP_OUTPUTTOKENCOMMITMENT,
    Op.OP_2DUP, Op.OP_EQUAL, Op.OP_TOALTSTACK, Op.OP_TOALTSTACK, Op.OP_DROP,
    Op.OP_FROMALTSTACK, Op.OP_EQUAL, Op.OP_FROMALTSTACK, Op.OP_BOOLOR, Op.OP_VERIFY,
  ].map((opcode) => ({ opcode })),
} as AuthenticationProgramStateCommon);

describe('targeted hashed return extraction', () => {
  it('recovers an independent copy of the hash-bound return preimage', () => {
    const recovered = extractHashedReturnCommitmentAtOutput([snapshot()], 7);
    expect(recovered).toEqual(value);
    expect(recovered).not.toBe(value);
  });

  it('does not accept another output, inactive code, or a mismatched digest', () => {
    expect(extractHashedReturnCommitmentAtOutput([snapshot()], 8)).toBeUndefined();
    const inactive = snapshot();
    inactive.controlStack = [false];
    expect(extractHashedReturnCommitmentAtOutput([inactive], 7)).toBeUndefined();
    const unrelated = snapshot();
    unrelated.stack[1][0] ^= 1;
    expect(extractHashedReturnCommitmentAtOutput([unrelated], 7)).toBeUndefined();
  });

  it.each([0, 5, 14])('rejects a changed covenant instruction at offset %s', (offset) => {
    const changed = snapshot();
    changed.instructions[offset] = { opcode: Op.OP_NOP };
    expect(extractHashedReturnCommitmentAtOutput([changed], 7)).toBeUndefined();
  });

  it('does not reinterpret ordinary short commitments as hashed returns', () => {
    const short = snapshot();
    short.stack[0] = value.slice(0, 128);
    short.stack[1] = sha256(short.stack[0]);
    expect(extractHashedReturnCommitmentAtOutput([short], 7)).toBeUndefined();
  });
});
