import { describe, expect, it } from 'vitest';
import type { Output } from '../../src/interfaces.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  finalizeReverseSuffixValueChunkLayout,
  type ReverseSuffixValueChunkHost,
} from '../../src/stateful/stb-reverse-suffix-value-chunks.js';

describe('reverse-suffix chunk layout', () => {
  it('preserves fixed output indices when authoritative suffix commitments are known', () => {
    const category = 'aa'.repeat(31) + '55';
    const chunkLock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x11), 0x87);
    const fixedLock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x22), 0x87);
    const funderLock = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac);
    const chunk = (commitment: string): Output => ({
      to: chunkLock,
      amount: 1200n,
      token: { category, amount: 0n, nft: { capability: 'mutable' as const, commitment } },
    });
    const outputs = [
      chunk('aa01'),
      chunk('aa02'),
      { to: fixedLock, amount: 1200n,
        token: { category, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      { to: funderLock, amount: 100_000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x6a), amount: 0n },
    ];
    const builder = { outputs } as unknown as TransactionBuilder;
    const commitments = new Map([['jobs', ['aa01', 'aa02']]]);
    const host: ReverseSuffixValueChunkHost = {
      valueChunkOutputs: [],
      allInputs: [],
      categoryId: category,
      delegateDynamicChunksAtSuffix: true,
      dynamicChunkVars: [{ name: 'jobs', lockingBytecode: chunkLock, delegateSuffix: true }],
      chunkRawCommitments: commitments,
      derivedChunkOutputs: new Map(),
      getChunkableValueWriteBand: () => undefined,
      setChunkRawCommitments: (name, values) => { commitments.set(name, values); },
      dynamicChunkOutputCount: () => 2,
      padOutputsToIndex: () => {},
    };

    finalizeReverseSuffixValueChunkLayout(host, builder);

    expect(builder.outputs[2]?.to).toEqual(fixedLock);
    expect(builder.outputs[2]?.token?.nft?.capability).toBe('minting');
    expect(builder.outputs[3]?.to).toEqual(funderLock);
    expect(builder.outputs[3]?.amount).toBe(100_000n);
    expect(builder.outputs.slice(4, 6).map((output) => output.token?.nft?.commitment))
      .toEqual(['aa01', 'aa02']);
    expect(builder.outputs).toHaveLength(7);
  });
});
