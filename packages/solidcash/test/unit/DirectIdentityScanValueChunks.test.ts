import { binToHex, type AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { computeCollectionHash, encodeInt, Op } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  persistValueChunkLock,
  type ExternalCallUtxoGroup,
  type StatefulTransactionBuilder,
  type ValueChunkWriteDescriptor,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import {
  deriveRouteValueChunks,
  extractFailingP2sh32OutputPin,
} from '../../src/stateful/route-value-chunk-helpers.js';

type Chunk = Parameters<StatefulTransactionBuilder['setDerivedChunkOutput']>[1];

const fixture = (): {
  value: Uint8Array; write: ValueChunkWriteDescriptor; lock: Uint8Array;
  group: ExternalCallUtxoGroup; stb: StatefulTransactionBuilder;
  outputs: Map<number, Chunk>; observations: Map<string, string>;
} => {
  const value = new Uint8Array(219).fill(0x61);
  const collectionSignature = 'records:mapping(uint256 => bytes)';
  const write: ValueChunkWriteDescriptor = {
    categoryId: '32'.repeat(32), collection: 'records', collectionSignature,
    collectionHash: binToHex(computeCollectionHash(collectionSignature)),
    keySlot: '43'.repeat(32), entryAccessSlot: 0, routeSlot: 0,
    operation: 'update', outputBase: 7, outputCount: 2,
  };
  const lock = persistValueChunkLock(write.categoryId, value, write)!;
  const group = {
    categoryId: write.categoryId, blockLayout: { slots: [] },
    valueChunkOutputBase: 7, valueChunkOutputCount: 2, valueChunkWrites: [write],
  } as unknown as ExternalCallUtxoGroup;
  const outputs = new Map<number, Chunk>();
  const stb = {
    getPublishJobEventsBand: () => undefined,
    getDerivedChunkOutputs: () => outputs,
    getObservedValueChunks: () => [],
    setDerivedChunkOutput: (index: number, chunk: Chunk) => {
      outputs.set(index, chunk);
      return true;
    },
  } as unknown as StatefulTransactionBuilder;
  const observations = new Map<string, string>();
  return { value, write, lock, group, stb, outputs, observations };
};

describe('direct identity-scan value chunk derivation', () => {
  it('does not interpret the last scanned output as a positional chunk requirement', () => {
    const { value, lock, group, stb, outputs, observations } = fixture();
    const instructions = [Op.OP_OUTPUTBYTECODE, Op.OP_DROP, Op.OP_EQUALVERIFY, Op.OP_2DROP]
      .map((opcode) => ({ opcode }));
    const trace = [
      { ip: 0, instructions, controlStack: [], stack: [value, lock, encodeInt(18n)] },
      { ip: 2, instructions, controlStack: [], stack: [value, lock, encodeInt(2n), encodeInt(0n)] },
    ] as AuthenticationProgramStateCommon[];
    expect(deriveRouteValueChunks(group, 0, trace, stb, observations, 'kernel-row-loop'))
      .toEqual({ changed: true, discovered: true });
    expect([...outputs.keys()]).toEqual([7, 8]);
    expect([...outputs.values()].map((chunk) => chunk.commitment)).toEqual([
      `0000${'61'.repeat(126)}`, `0100${'61'.repeat(65)}`,
    ]);
    expect([...outputs.values()].every((chunk) => binToHex(chunk.lockingBytecode) === binToHex(lock))).toBe(true);

    expect(deriveRouteValueChunks(group, 0, trace, stb, observations, 'kernel-row-loop'))
      .toEqual({ changed: false, discovered: false });
    expect(group.valueChunkOutputBase).toBe(7);
    expect([...outputs.keys()]).toEqual([7, 8]);
  });

  it('retains positional pinning when no identity count mismatch exists', () => {
    const { value, lock, group, stb, outputs, observations } = fixture();
    const instructions = [Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY].map((opcode) => ({ opcode }));
    const trace = [
      { ip: 0, instructions, controlStack: [], stack: [value, lock, encodeInt(7n)] },
      { ip: 1, instructions, controlStack: [], stack: [value, lock, Uint8Array.of(0x51)] },
    ] as AuthenticationProgramStateCommon[];

    expect(deriveRouteValueChunks(group, 0, trace, stb, observations, 'kernel-row-loop'))
      .toEqual({ changed: true, discovered: true });
    expect([...outputs.keys()]).toEqual([7, 8]);
  });

  it.each([
    ['matching commitments', Uint8Array.of(0, 0, 0x61), Uint8Array.of(0, 0, 0x61)],
    ['different commitments', Uint8Array.of(0, 0, 0x61), Uint8Array.of(1, 0, 0x61)],
    ['chunk counts', encodeInt(2n), encodeInt(0n)],
  ])('does not infer a positional lock from %s with an unrelated lock deeper in the stack', (_name, expected, actual) => {
    const { value, lock } = fixture();
    const instructions = [Op.OP_OUTPUTBYTECODE, Op.OP_EQUALVERIFY].map((opcode) => ({ opcode }));
    const trace = [
      { ip: 0, instructions, controlStack: [], stack: [value, lock, encodeInt(8n)] },
      { ip: 1, instructions, controlStack: [], stack: [value, lock, expected, actual] },
    ] as AuthenticationProgramStateCommon[];

    expect(extractFailingP2sh32OutputPin(trace)).toBeUndefined();
  });
});
