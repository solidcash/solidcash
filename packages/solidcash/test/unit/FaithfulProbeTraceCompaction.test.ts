import { encodeInt, Op, sha256 as sha256Sync, VALUE_CHUNK_SIZE, VALUE_HEAD_SIZE } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  compactFaithfulProbeTrace,
} from '../../src/stateful/StatefulContract.js';
import {
  extractIdentityScanValueChunkPin,
  selectHashedValueForChunkPin,
} from '../../src/stateful/StatefulTransactionBuilder.js';

type TestState = {
  ip: number;
  instructions: Array<{ opcode: number; data?: Uint8Array }>;
  stack: Uint8Array[];
  alternateStack: Uint8Array[];
  controlStack: Array<boolean | object>;
  error?: string;
};

const state = (
  instructions: TestState['instructions'], ip: number, stack: Uint8Array[] = [],
  extras: Partial<TestState> = {},
): TestState => ({ instructions, ip, stack, alternateStack: [], controlStack: [], ...extras });

const p2sh32 = (digest: Uint8Array): Uint8Array => Uint8Array.from([
  0xaa, 0x20, ...digest.subarray(0, 32), 0x87,
]);

describe('faithful OP_INVOKE probe trace compaction', () => {
  it('preserves identity-count pins while dropping irrelevant cloned states', () => {
    const payload = new Uint8Array(180).fill(0x41);
    const lock = p2sh32(sha256Sync(Uint8Array.of(7)));
    const identity = [
      { opcode: Op.OP_DROP },
      { opcode: Op.OP_EQUALVERIFY },
      { opcode: Op.OP_2DROP },
    ];
    const noise = [{ opcode: Op.OP_DUP }];
    const trace = [
      state(noise, 0, [new Uint8Array(4096).fill(9)]),
      ...Array.from({ length: 200 }, () => state(noise, 0, [new Uint8Array(1024)])),
      state(identity, 1, [payload, lock, encodeInt(3n), encodeInt(1n)]),
      state(noise, 0, [Uint8Array.of(1)], { error: 'failed verify' }),
    ] as never;

    const compact = compactFaithfulProbeTrace(trace);
    expect(compact.length).toBeLessThan(10);
    expect(extractIdentityScanValueChunkPin(compact)).toEqual({ lockingBytecode: lock, nNew: 3 });
    expect(compact.at(-1)?.error).toBe('failed verify');
  });

  it('keeps output/equality pairs and an outlined chunk-frame witness in execution order', () => {
    const caller = [
      { opcode: Op.OP_0, data: Uint8Array.of(VALUE_CHUNK_SIZE) },
      { opcode: Op.OP_MUL },
      { opcode: Op.OP_0, data: Uint8Array.of(VALUE_HEAD_SIZE) },
      { opcode: Op.OP_ADD },
    ];
    const helper = [{ opcode: Op.OP_SWAP }, { opcode: Op.OP_OUTPUTBYTECODE }, { opcode: Op.OP_EQUALVERIFY }];
    const noise = [{ opcode: Op.OP_DUP }];
    const expected = p2sh32(sha256Sync(Uint8Array.of(2)));
    const actual = p2sh32(sha256Sync(Uint8Array.of(3)));
    const trace = [
      state(caller, 0),
      state(noise, 0, [new Uint8Array(2048)]),
      state(helper, 1, [Uint8Array.of(0), Uint8Array.of(1), expected, Uint8Array.of(12)]),
      state(noise, 0),
      state(helper, 2, [expected, actual]),
      state(noise, 0, [], { error: 'failed verify' }),
    ] as never;

    const compact = compactFaithfulProbeTrace(trace);
    const observed = compact.filter((item) => item.instructions.length > 0)
      .map((item) => item.instructions[item.ip]?.opcode);
    expect(observed).toContain(Op.OP_OUTPUTBYTECODE);
    expect(observed).toContain(Op.OP_EQUALVERIFY);
    expect(compact.some((item) => item.instructions === caller)).toBe(true);
    expect(compact.find((item) => item.instructions[item.ip]?.opcode === Op.OP_OUTPUTBYTECODE)?.stack)
      .toEqual([Uint8Array.of(0), Uint8Array.of(1), expected, Uint8Array.of(12)]);
  });

  it('retains authenticated long values, digests, and value tails without retaining decoy stacks', () => {
    const value = new Uint8Array(180).fill(0x51);
    const digest = sha256Sync(value);
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, value.length, true);
    const tail = Uint8Array.from([...length, ...digest, ...value.slice(0, VALUE_HEAD_SIZE)]);
    const decoy = new Uint8Array(4096).fill(0x61);
    const noise = [{ opcode: Op.OP_DUP }];
    const terminal = state(noise, 0, [Uint8Array.of(1)], { error: 'terminal' });
    const compact = compactFaithfulProbeTrace([
      state(noise, 0, [decoy]),
      state(noise, 0, [value, digest, tail]),
      terminal,
    ] as never);
    const stacks = compact.flatMap((item) => [item.stack, item.alternateStack]);
    const selected = selectHashedValueForChunkPin(stacks, undefined, 2);

    expect(selected?.value).toBe(value);
    expect(stacks.some((stack) => stack.includes(tail))).toBe(true);
    expect(compact.at(-1)?.error).toBe('terminal');
    expect(compact.filter((item) => item !== compact.at(-1)).every((item) => (
      item.controlStack.every((frame) => typeof frame === 'boolean')
    ))).toBe(true);
  });

  it('fails closed rather than truncating distinct extractor evidence', () => {
    const noise = [{ opcode: Op.OP_DUP }];
    const trace = Array.from({ length: 4097 }, (_, index) => {
      const value = new Uint8Array(61);
      new DataView(value.buffer).setUint32(0, index, true);
      return state(noise, 0, [value]);
    }) as never;
    expect(() => compactFaithfulProbeTrace(trace)).toThrow(/too many distinct extractor values/);
  });
});
