import { describe, expect, it } from 'vitest';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import {
  stripSurplusDerivedValueChunkLocks,
  type DerivedValueChunkApplyHost,
} from '../../src/stateful/stb-derived-value-chunk-apply.js';

const categoryId = 'ab'.repeat(31) + '54';
const lock = Uint8Array.from([0xaa, 0x20, ...Array<number>(32).fill(0x42), 0x87]);
const resourceIdentity = 'category:collection:slot';
const commitments = ['000061', '010062'];

function fixture(conflict = false): {
  host: DerivedValueChunkApplyHost;
  builder: TransactionBuilder;
} {
  const outputs = Array.from({ length: 14 }, () => ({
    to: Uint8Array.of(0x51), amount: 1000n,
  })) as Array<{ to: Uint8Array; amount: bigint; token?: {
    category: string; amount: bigint; nft: { capability: 'mutable'; commitment: string };
  } }>;
  const derivedChunkOutputs = new Map();
  for (const index of [10, 11, 12, 13]) {
    const part = index % 2;
    const commitment = conflict && index === 12 ? '000063' : commitments[part];
    derivedChunkOutputs.set(index, {
      resourceIdentity, resourcePart: `chunk:${part}`, semanticKind: 'valueChunk',
      categoryId, lockingBytecode: lock, commitment, fixedIndex: false,
    });
    outputs[index] = {
      to: lock, amount: 1200n,
      token: { category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment } },
    };
  }
  return {
    host: { categoryId, derivedChunkOutputs,
      allInputs: Array.from({ length: 12 }, () => ({})),
    } as unknown as DerivedValueChunkApplyHost,
    builder: { outputs } as unknown as TransactionBuilder,
  };
}

describe('derived value-chunk resource parts', () => {
  it('retains one physical continuation per authenticated part after convergence', () => {
    const { host, builder } = fixture();
    expect(stripSurplusDerivedValueChunkLocks(host, builder)).toBe(2);
    expect([...host.derivedChunkOutputs.keys()]).toEqual([10, 11]);
    expect(builder.outputs[10].token?.nft?.commitment).toBe(commitments[0]);
    expect(builder.outputs[11].token?.nft?.commitment).toBe(commitments[1]);
    expect(builder.outputs[12].to).toEqual(Uint8Array.of(0x51));
    expect(builder.outputs[13].to).toEqual(Uint8Array.of(0x51));
  });

  it('rejects conflicting observations for one compiler-owned part', () => {
    const { host, builder } = fixture(true);
    expect(() => stripSurplusDerivedValueChunkLocks(host, builder))
      .toThrow(/Conflicting derived value-chunk resource part/);
  });
});
