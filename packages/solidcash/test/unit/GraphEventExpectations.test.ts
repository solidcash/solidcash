import { describe, expect, it } from 'vitest';
import { binToHex, type Output } from '@bitauth/libauth';
import { encodeInt, Op, scriptToBytecode, type Script } from '@solidcash/utils';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { evaluateProbeTrace } from '../../src/stateful/faithful-probe-trace.js';
import { extractGraphEventExpectations } from '../../src/stateful/graph-event-expectations.js';

const lockA = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(1), 0x87]);
const lockB = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(2), 0x87]);
const payload = Uint8Array.of(1, 7);
// Non-palindromic, so the internal order OP_OUTPUTTOKENCATEGORY answers with differs from display order.
const CATEGORY = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xfc : 0x03));
const CATEGORY_INTERNAL = CATEGORY.slice().reverse();
const output = (lockingBytecode: Uint8Array, commitment = new Uint8Array()): Output => ({
  lockingBytecode, valueSatoshis: 1000n,
  token: { category: CATEGORY, amount: 0n, nft: { capability: 'none', commitment } },
});
const provider = { consensusLimits: {
  maximumInputBytes: 100_000, maximumStackItemBytes: 100_000,
  maximumTransactionBytes: 1_000_000, maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800, hashDigestIterationsPerByte: 10_000,
} } as NetworkProvider;

// The compiler searches each event's bounded window using both its payload and covenant identity.
const search = (indices: number[]): Script => [
  payload, lockB, Op.OP_1NEGATE,
  ...indices.flatMap((index): Script => [
    encodeInt(BigInt(index)), Op.OP_DUP, Op.OP_4, Op.OP_PICK, Op.OP_SWAP,
    Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL,
    Op.OP_3, Op.OP_PICK, Op.OP_2, Op.OP_PICK, Op.OP_OUTPUTBYTECODE, Op.OP_EQUAL,
    Op.OP_BOOLAND, Op.OP_IF, Op.OP_SWAP, Op.OP_DROP, Op.OP_ELSE, Op.OP_DROP, Op.OP_ENDIF,
  ]),
];

function trace(script: Script, outputs: Output[], complete: boolean): ReturnType<typeof evaluateProbeTrace> {
  return evaluateProbeTrace(provider, {
    inputIndex: 0,
    sourceOutputs: [{ valueSatoshis: 10_000n, lockingBytecode: scriptToBytecode(script) }],
    transaction: {
      version: 2, locktime: 0, outputs,
      inputs: [{
        outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
        sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(),
      }],
    },
  }, complete);
}

describe.each([false, true])('graph event expectation extraction (complete=%s)', (complete) => {
  it('selects one matching covenant when two event identities have the same payload schema', () => {
    const outputs = [output(lockA, payload), output(lockB)];
    const states = trace([
      ...search([0, 1]), Op.OP_DUP, Op.OP_0, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
    ], outputs, complete);
    expect(states.at(-1)?.error).toBeDefined();
    expect([...extractGraphEventExpectations(states, new Set([0, 1]), outputs)])
      .toEqual([[1, { commitment: binToHex(payload), lockingBytecode: binToHex(lockB) }]]);
  });

  it('does not turn a later token category operand into an event locking script', () => {
    const outputs = [output(lockA, payload), output(lockB, payload)];
    const states = trace([
      ...search([0, 1]), Op.OP_DUP, Op.OP_0, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
      Op.OP_OUTPUTTOKENCATEGORY, CATEGORY_INTERNAL, Op.OP_EQUALVERIFY,
      Op.OP_2DROP, Op.OP_1,
    ], outputs, complete);
    expect(states.at(-1)?.error).toBeUndefined();
    expect([...extractGraphEventExpectations(states, new Set([0, 1]), outputs)])
      .toEqual([[1, { commitment: binToHex(payload), lockingBytecode: binToHex(lockB) }]]);
  });

  it('keeps repeated identical events in separate row windows', () => {
    const outputs = [output(lockB, payload), output(lockB, payload)];
    const states = trace([
      ...search([0]), Op.OP_OUTPUTTOKENCATEGORY, Op.OP_DROP, Op.OP_2DROP,
      ...search([1]), Op.OP_2DROP, Op.OP_DROP, Op.OP_1,
    ], outputs, complete);
    expect([...extractGraphEventExpectations(states, new Set([0, 1]), outputs)].map(([index]) => index))
      .toEqual([0, 1]);
  });

  it('uses one empty candidate while preserving another event identity', () => {
    const outputs = [output(lockA, payload), { lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1000n }];
    const states = trace([
      ...search([0, 1]), Op.OP_DUP, Op.OP_0, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
    ], outputs, complete);
    expect([...extractGraphEventExpectations(states, new Set([0, 1]), outputs)])
      .toEqual([[1, { commitment: binToHex(payload), lockingBytecode: binToHex(lockB) }]]);
  });

  it('does not replace candidates assigned to other event covenants', () => {
    const outputs = [output(lockA, payload)];
    const states = trace(search([0]), outputs, complete);
    expect(extractGraphEventExpectations(states, new Set([0]), outputs).size).toBe(0);
  });

  it('ignores bare equality and candidates outside the published event indices', () => {
    const outputs = [output(lockB, payload)];
    const states = trace([
      ...search([0]), Op.OP_2DROP, Op.OP_DROP,
      payload, Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL,
    ], outputs, complete);
    expect(extractGraphEventExpectations(states, new Set(), outputs).size).toBe(0);
  });
});
