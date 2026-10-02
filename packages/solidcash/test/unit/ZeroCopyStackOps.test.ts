import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, flattenBinArray, hash256, sha256,
  utf8ToBin,
} from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';

// The provider VM pushes duplicated items without copying them and splits into views. Each program below runs on
// libauth's own VM and on the provider VM; the final stacks, errors and counters must agree (the configured maxima
// differ, since this provider publishes its own limits).
const OP = {
  DROP: 0x75, DUP: 0x76, IFDUP: 0x73, OVER: 0x78, PICK: 0x79, TUCK: 0x7d, TWODUP: 0x6e, THREEDUP: 0x6f,
  TWOOVER: 0x70, SPLIT: 0x7f, CAT: 0x7e, DEFINE: 0x89, INVOKE: 0x8a, ZERO: 0x00, ONE: 0x51, TWO: 0x52, THREE: 0x53,
  FIVE: 0x55, SEVEN: 0x57, ADD: 0x93,
} as const;

const bytes = (...items: Array<number | Uint8Array>): Uint8Array => flattenBinArray(
  items.map((item) => (typeof item === 'number' ? Uint8Array.of(item) : item)),
);
const push = (data: Uint8Array): Uint8Array => encodeDataPush(data);

function spend(redeem: Uint8Array): Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0] {
  return {
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 2_000n }],
    transaction: {
      version: 2,
      inputs: [{
        outpointIndex: 0,
        outpointTransactionHash: sha256.hash(utf8ToBin('zero-copy stack operations')),
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

const BODY = bytes(OP.ONE, OP.TWO, OP.ADD);
const programs: Array<[string, Uint8Array]> = [
  ['every duplicating operation after a split', bytes(push(Uint8Array.of(1, 2, 3, 4, 5)), OP.TWO, OP.SPLIT,
    OP.TWODUP, OP.THREEDUP, OP.TWOOVER, OP.TUCK, OP.OVER, OP.DUP, OP.THREE, OP.PICK, OP.IFDUP, OP.ZERO, OP.IFDUP,
    OP.DROP, OP.CAT, OP.CAT)],
  ['a split at either end', bytes(push(Uint8Array.of(9, 8)), OP.ZERO, OP.SPLIT, OP.CAT, OP.TWO, OP.SPLIT)],
  ['a split index past the item', bytes(push(Uint8Array.of(1, 2)), OP.FIVE, OP.SPLIT)],
  ['a pick past the stack', bytes(OP.ONE, OP.SEVEN, OP.PICK)],
  ['a defined body cut out of a larger item', bytes(push(bytes(BODY, 0xaa, 0xbb)), OP.THREE, OP.SPLIT, OP.DROP,
    OP.ONE, OP.DEFINE, OP.ONE, OP.INVOKE)],
];

const summary = (state: { stack: Uint8Array[]; error?: string; metrics: object }): string => JSON.stringify({
  stack: state.stack.map(binToHex),
  error: state.error,
  counters: Object.entries(state.metrics).filter(([key]) => !key.startsWith('maximum')),
}, (_key, value: unknown) => (typeof value === 'bigint' ? `${value}` : value));

describe('zero-copy stack operations', () => {
  const stock = createVirtualMachineBch2026(false);
  const zeroCopy = createVirtualMachineBch2026ForProvider(provider, undefined, { standard: false });

  for (const [name, redeem] of programs) {
    it(`matches libauth on ${name}`, () => {
      expect(summary(zeroCopy.evaluate(spend(redeem)) as never)).toBe(summary(stock.evaluate(spend(redeem)) as never));
    });
  }

  it('stores a body defined from a view as a compact copy', () => {
    const state = zeroCopy.evaluate(spend(programs[4]![1])) as unknown as { functionTable: Record<string, Uint8Array> };
    const body = state.functionTable['01']!;
    expect(binToHex(body)).toBe(binToHex(BODY));
    expect(body.byteOffset).toBe(0);
    expect(body.byteLength).toBe(body.buffer.byteLength);
  });
});
