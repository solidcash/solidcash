import { hash160, hash256 } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { describe, expect, it } from 'vitest';
import {
  executableMayExecuteOutputTokenCommitment,
  extractAuthenticatedSpendBytecode,
  inputMayExecuteOutputTokenCommitment,
} from '../../src/message-bus/executable-opcode-eligibility.js';

const push = (data: Uint8Array): number[] => {
  if (data.length > 75) throw new Error('test push helper only supports direct pushes');
  return [data.length, ...data];
};

const define = (body: Uint8Array, identifier = Op.OP_1): number[] => [
  ...push(body), identifier, Op.OP_DEFINE,
];

const p2sh20 = (redeem: Uint8Array): Uint8Array => Uint8Array.of(
  Op.OP_HASH160, 20, ...hash160(redeem), Op.OP_EQUAL,
);

const p2sh32 = (redeem: Uint8Array): Uint8Array => Uint8Array.of(
  Op.OP_HASH256, 32, ...hash256(redeem), Op.OP_EQUAL,
);

describe('executable OP_OUTPUTTOKENCOMMITMENT eligibility', () => {
  it('finds the opcode in a direct executable while ignoring identical pushed data', () => {
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT,
    ))).toBe(true);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      ...push(Uint8Array.of(Op.OP_OUTPUTTOKENCOMMITMENT)), Op.OP_DROP, Op.OP_1,
    ))).toBe(false);
  });

  it('inspects statically defined bodies only when the executable can invoke them', () => {
    const body = Uint8Array.of(Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(...define(body), Op.OP_1))).toBe(false);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      ...define(body), Op.OP_1, Op.OP_INVOKE,
    ))).toBe(true);
  });

  it('follows nested OP_DEFINE bodies behind OP_INVOKE', () => {
    const inner = Uint8Array.of(Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT);
    const outer = Uint8Array.of(...define(inner, Op.OP_2), Op.OP_2, Op.OP_INVOKE);
    const root = Uint8Array.of(...define(outer), Op.OP_1, Op.OP_INVOKE);
    expect(executableMayExecuteOutputTokenCommitment(root)).toBe(true);
  });

  it('returns eligible for malformed bytecode and dynamically-shaped definitions', () => {
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(Op.OP_PUSHDATA_1))).toBe(true);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      Op.OP_DUP, Op.OP_1, Op.OP_DEFINE,
    ))).toBe(true);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      Op.OP_DUP, Op.OP_1, Op.OP_DEFINE, Op.OP_1, Op.OP_INVOKE,
    ))).toBe(true);
  });

  it('returns ineligible for a valid invoke graph proven not to inspect output commitments', () => {
    const body = Uint8Array.of(Op.OP_1, Op.OP_DROP, Op.OP_1);
    expect(executableMayExecuteOutputTokenCommitment(Uint8Array.of(
      ...define(body), Op.OP_1, Op.OP_INVOKE,
    ))).toBe(false);
  });
});

describe('authenticated input executable extraction', () => {
  const redeem = Uint8Array.of(Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT);
  const unlocking = Uint8Array.of(...push(Uint8Array.of(1, 2, 3)), ...push(redeem));

  it('extracts matching P2SH20 and P2SH32 redeem bytecode', () => {
    expect(extractAuthenticatedSpendBytecode(p2sh20(redeem), unlocking)).toEqual(redeem);
    expect(extractAuthenticatedSpendBytecode(p2sh32(redeem), unlocking)).toEqual(redeem);
    expect(inputMayExecuteOutputTokenCommitment(p2sh32(redeem), unlocking)).toBe(true);
  });

  it('returns eligible when a P2SH redeem program is malformed, absent, or fails authentication', () => {
    const cleanRedeem = Uint8Array.of(Op.OP_1);
    expect(inputMayExecuteOutputTokenCommitment(p2sh32(cleanRedeem), Uint8Array.of(Op.OP_PUSHDATA_1))).toBe(true);
    expect(inputMayExecuteOutputTokenCommitment(p2sh32(cleanRedeem), Uint8Array.of(Op.OP_1))).toBe(true);
    expect(inputMayExecuteOutputTokenCommitment(p2sh32(cleanRedeem), unlocking)).toBe(true);
  });

  it('inspects non-P2SH source locking bytecode directly', () => {
    expect(extractAuthenticatedSpendBytecode(Uint8Array.of(Op.OP_1), Uint8Array.of())).toEqual(
      Uint8Array.of(Op.OP_1),
    );
    expect(inputMayExecuteOutputTokenCommitment(Uint8Array.of(Op.OP_1), Uint8Array.of())).toBe(false);
    expect(inputMayExecuteOutputTokenCommitment(
      Uint8Array.of(Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT), Uint8Array.of(),
    )).toBe(true);
  });
});
