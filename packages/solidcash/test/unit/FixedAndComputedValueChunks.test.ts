import { describe, expect, it } from 'vitest';
import type { Output } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  appendValueChunks, type MaterializeValueAndDynamicChunksHost,
} from '../../src/stateful/stb-materialize-value-and-dynamic-chunks.js';

const categoryId = '71'.repeat(32);
const lock = (byte: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(byte), 0x87]);
const commitment = '0000010203';

function fixture(fixedLock: Uint8Array, fixedCategory = categoryId): {
  host: MaterializeValueAndDynamicChunksHost; builder: TransactionBuilder; outputs: Output[];
} {
  const outputs: Output[] = [];
  const builder = { outputs, addOutput: (output: Output) => { outputs.push(output); } } as TransactionBuilder;
  const host = {
    categoryId, valueChunkOutputs: [],
    derivedChunkOutputs: new Map([[4, {
      fixedIndex: true, commitment, lockingBytecode: fixedLock, categoryId: fixedCategory,
    }]]),
    getChunkableValueWriteBand: () => ({ start: 4, end: 4, nNew: 1 }),
    getValueChunkVars: () => [{ id: 'records#0', lockingBytecode: lock(0x31) }],
    valueChunkRawCommitments: new Map([['records#0', [commitment]]]),
  } as unknown as MaterializeValueAndDynamicChunksHost;
  return { host, builder, outputs };
}

describe('fixed and computed continuation families', () => {
  it('keeps a computed resource when another resource has fixed pins', () => {
    const { host, builder, outputs } = fixture(lock(0x42));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ to: lock(0x31), token: { category: categoryId } });
  });

  it('does not deduplicate another state owner with the same locking bytecode', () => {
    const { host, builder, outputs } = fixture(lock(0x31), '82'.repeat(32));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
  });

  it('does not append a duplicate of a fixed continuation', () => {
    const { host, builder, outputs } = fixture(lock(0x31));
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(0);
  });

  it('retains an unpinned chunk of the same resource', () => {
    const { host, builder, outputs } = fixture(lock(0x31));
    host.valueChunkRawCommitments = new Map([['records#0', [commitment, '0100040506']]]);
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].token?.nft?.commitment).toBe('0100040506');
  });

  it('keeps an unrelated staged resource while excluding an exact pinned duplicate', () => {
    const { host, builder, outputs } = fixture(lock(0x42));
    Object.assign(host, {
      getValueChunkVars: () => [],
      valueChunkOutputs: [lock(0x42), lock(0x53)].map((to) => ({
        to, amount: 1200n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      })),
    });
    appendValueChunks(host, builder);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].to).toEqual(lock(0x53));
  });
});
