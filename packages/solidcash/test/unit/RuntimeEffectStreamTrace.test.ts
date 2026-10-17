import { bigIntToVmNumber, binToHex, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { Op } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { BoundedProbeTraceCollector } from '../../src/stateful/faithful-probe-trace.js';
import { extractRuntimeEffectStreamRuns } from '../../src/stateful/runtime-effect-stream-trace.js';

// One effect verifier record check as the probe observer sees it.
const CHECK = [
  Op.OP_OUTPUTTOKENCATEGORY, Op.OP_EQUALVERIFY, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUALVERIFY,
  Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY, Op.OP_OUTPUTTOKENAMOUNT, Op.OP_OUTPUTVALUE,
].map((opcode) => ({ opcode }));
const BASE = 5;
const lock = (fill: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(fill), 0x87]);
const headLock = lock(1);
const continuationLock = lock(2);
// A 1,504-byte payload: eleven 128-byte chunks and a 96-byte tail.
const chunks = Array.from({ length: 12 }, (_unused, index) => new Uint8Array(index === 11 ? 96 : 128).fill(index + 1));
const records = chunks.map((chunk, index) => Uint8Array.from([
  0x4c, chunk.length, ...chunk, ...(index === 0 ? headLock : continuationLock),
]));
const expected = [{
  base: BASE,
  records: chunks.map((chunk, index) => ({
    commitment: binToHex(chunk), lockingBytecode: index === 0 ? headLock : continuationLock,
  })),
}];

/** The verifier at check `ip` of record `remaining`, the last unchecked one; it checks the run from its end. */
const step = (remaining: number, ip = 0): AuthenticationProgramStateCommon => {
  const index = bigIntToVmNumber(BigInt(BASE + remaining - 1));
  return {
    instructions: CHECK, ip, controlStack: [],
    stack: [
      new Uint8Array(32).fill(0xcc), bigIntToVmNumber(BigInt(BASE)), bigIntToVmNumber(BigInt(remaining)),
      Uint8Array.of(), index, records[remaining - 1]!, index,
    ],
    alternateStack: records.slice(0, remaining - 1).map((record) => Uint8Array.from([1, ...record])),
  } as unknown as AuthenticationProgramStateCommon;
};
const run = (): AuthenticationProgramStateCommon[] => records.map((_record, index) => step(records.length - index));

describe('runtime effect stream trace', () => {
  it('learns an exact compact record only when explicitly requested, without claiming its unseen prefix', () => {
    const compact = {
      ...step(2),
      stack: [new Uint8Array(32).fill(0xcc), bigIntToVmNumber(BigInt(BASE)), bigIntToVmNumber(2n),
        bigIntToVmNumber(BigInt(BASE + 1)), Uint8Array.of(0x57), headLock,
        bigIntToVmNumber(BigInt(BASE + 1))],
      alternateStack: [Uint8Array.of(0x56)],
    };
    expect(extractRuntimeEffectStreamRuns([compact])).toEqual([]);
    expect(extractRuntimeEffectStreamRuns([compact], { includeCompactRecords: true })).toEqual([{
      base: BASE + 1, records: [{ commitment: '57', lockingBytecode: headLock }],
    }]);
    expect(extractRuntimeEffectStreamRuns([{ ...compact, controlStack: [false] }],
      { includeCompactRecords: true })).toEqual([]);
  });

  it('reads a whole run at the verifier step that holds every record', () => {
    expect(extractRuntimeEffectStreamRuns(run())).toEqual(expected);
  });

  it('reads no run once a verifier step lost its stacks, not the prefix a later step holds', () => {
    const [first, ...rest] = run();
    const trimmed = { ...first!, stack: first!.stack.slice(-4), alternateStack: [] };
    expect(extractRuntimeEffectStreamRuns([trimmed, ...rest])).toEqual([]);
  });

  it('never learns a truncated run from a bounded probe trace that ran on past the verifier', () => {
    const collector = new BoundedProbeTraceCollector();
    for (let remaining = records.length; remaining >= 1; remaining -= 1) {
      for (let ip = 0; ip < CHECK.length; ip += 1) collector.observe(step(remaining, ip));
    }
    const later = { ...step(1, 4), stack: [Uint8Array.of(1)], alternateStack: [] };
    for (let count = 0; count < 4; count += 1) collector.observe(later);
    const runs = extractRuntimeEffectStreamRuns(collector.finish({ ...later, error: 'later check' }));
    expect(runs.every((learned) => learned.records.length === records.length)).toBe(true);
  });
});
