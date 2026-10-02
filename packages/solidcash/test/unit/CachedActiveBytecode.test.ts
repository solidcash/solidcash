import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2sh32,
  flattenBinArray, hash256, sha256, utf8ToBin,
} from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';

// OP_ACTIVEBYTECODE runs cached on a provider VM with raised limits. Each redeem script below compares the hash of
// an active bytecode with a constant placed where it is not part of that bytecode, so a spend verifies only when the
// cached push is libauth's encoding of the same instructions.
const OP = {
  ACTIVEBYTECODE: 0xc1, CODESEPARATOR: 0xab, DEFINE: 0x89, EQUAL: 0x87, EQUALVERIFY: 0x88, INVOKE: 0x8a,
  NIP: 0x77, NUMEQUAL: 0x9c, ONE: 0x51, FIVE: 0x55, SHA256: 0xa8, SIZE: 0x82, DROP: 0x75,
} as const;

const bytes = (...items: Array<number | Uint8Array>): Uint8Array => flattenBinArray(
  items.map((item) => (typeof item === 'number' ? Uint8Array.of(item) : item)),
);
const push = (data: Uint8Array): Uint8Array => encodeDataPush(data);
const digest = (data: Uint8Array): Uint8Array => sha256.hash(data);

function spend(redeem: Uint8Array): Parameters<ReturnType<typeof createVirtualMachineBch2026>['verify']>[0] {
  return {
    sourceOutputs: [{ lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 2_000n }],
    transaction: {
      version: 2,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: digest(utf8ToBin('cached active bytecode')),
        sequenceNumber: 0,
        unlockingBytecode: push(redeem),
      }],
      outputs: [{ lockingBytecode: Uint8Array.of(OP.ONE), valueSatoshis: 1_000n }],
      locktime: 0,
    },
  };
}

const provider = {
  consensusLimits: {
    maximumInputBytes: 100_000,
    maximumStackItemBytes: 100_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 3,
  },
} as unknown as NetworkProvider;

// The tail after a separator: its own encoding is what OP_ACTIVEBYTECODE pushes there.
const tail = bytes(OP.ACTIVEBYTECODE, OP.SHA256, OP.EQUAL);
const afterOneSeparator = bytes(push(digest(tail)), OP.CODESEPARATOR, tail);
const secondTail = tail;
const firstTail = bytes(OP.ACTIVEBYTECODE, OP.SHA256, OP.EQUALVERIFY, push(digest(secondTail)), OP.CODESEPARATOR,
  secondTail);
const afterTwoSeparators = bytes(push(digest(firstTail)), OP.CODESEPARATOR, firstTail);
// Without a separator the whole script is active: five bytes, which the script checks by size.
const wholeScript = bytes(OP.ACTIVEBYTECODE, OP.SIZE, OP.NIP, OP.FIVE, OP.NUMEQUAL);
// Inside an OP_DEFINE body the body is active; invoked twice, so the second push is a cache hit.
const body = bytes(OP.ACTIVEBYTECODE, OP.ONE, OP.DROP);
const functionBody = bytes(push(body), OP.ONE, OP.DEFINE,
  push(digest(body)), OP.ONE, OP.INVOKE, OP.SHA256, OP.EQUALVERIFY,
  push(digest(body)), OP.ONE, OP.INVOKE, OP.SHA256, OP.EQUAL);

describe('cached OP_ACTIVEBYTECODE', () => {
  const plain = createVirtualMachineBch2026(false);
  const cached = createVirtualMachineBch2026ForProvider(provider, undefined, { standard: false });

  for (const [name, redeem] of [
    ['one code separator', afterOneSeparator],
    ['two code separators', afterTwoSeparators],
    ['no code separator', wholeScript],
    ['an OP_DEFINE body invoked twice', functionBody],
  ] as const) {
    it(`pushes libauth's encoding after ${name}`, () => {
      expect(encodeAuthenticationInstructions([]).length).toBe(0);
      expect(plain.verify(spend(redeem))).toBe(true);
      // Twice: the second evaluation reuses the decoded redeem script, so every push comes from the cache.
      expect(cached.verify(spend(redeem))).toBe(true);
      expect(cached.verify(spend(redeem))).toBe(true);
    });
  }

  it('still refuses an active bytecode that differs from the expected one', () => {
    const wrong = bytes(push(digest(bytes(OP.ACTIVEBYTECODE))), OP.CODESEPARATOR, tail);
    expect(plain.verify(spend(wrong))).not.toBe(true);
    expect(cached.verify(spend(wrong))).not.toBe(true);
  });
});
