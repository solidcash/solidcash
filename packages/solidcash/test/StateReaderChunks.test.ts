import { describe, it, expect } from 'vitest';
import {
  StateLayout, buildChunkCommitment, splitValueIntoChunks, buildPushdataCommitment,
} from '@solidcash/utils';
import { utf8ToBin, binToHex } from '@bitauth/libauth';
import { StateReader } from '../src/stateful/StateReader.js';
import { Utxo } from '../src/interfaces.js';

const categoryId = 'aa'.repeat(32);

// A layout: non-dynamic int `a` + dynamic string `b`, both in data NFT 0.
const layout: StateLayout = {
  dataNftCount: 1,
  commitmentLimit: 128,
  variables: [
    { name: 'a', type: 'uint256', nftIndex: 0, fieldIndex: 0 },
    { name: 'b', type: 'string', nftIndex: 0, fieldIndex: 1, dynamic: true },
  ],
};

function chunkUtxo(idx: number, data: Uint8Array, vout: number): Utxo {
  return {
    txid: 'bb'.repeat(32),
    vout,
    satoshis: 1200n,
    token: {
      amount: 0n,
      category: categoryId,
      nft: { capability: 'mutable', commitment: buildChunkCommitment(idx, data, 128) },
    },
  };
}

describe('StateReader chunk discovery + assembly', () => {
  const reader = new StateReader(layout);

  it('orders chunks by verified chunkIndex regardless of UTXO order', () => {
    const value = utf8ToBin('x'.repeat(200)); // 2 chunks
    const [c0, c1] = splitValueIntoChunks(value);
    // Provide UTXOs permuted (chunk 1 before chunk 0).
    const ordered = reader.findChunkNfts([chunkUtxo(1, c1, 5), chunkUtxo(0, c0, 9)], categoryId);
    expect(ordered.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(binToHex(ordered[0].chunkData)).toBe(binToHex(c0));
  });

  it('ignores UTXOs of a different category', () => {
    const value = utf8ToBin('hello');
    const [c0] = splitValueIntoChunks(value);
    const foreign: Utxo = {
      ...chunkUtxo(0, c0, 1),
      token: { amount: 0n, category: 'cc'.repeat(32), nft: { capability: 'mutable', commitment: buildChunkCommitment(0, c0, 128) } },
    };
    expect(reader.findChunkNfts([foreign], categoryId)).toEqual([]);
  });

  it('readStateFromChain assembles a long string from its chunks and truncates to A$len', async () => {
    const text = 'the quick brown fox jumps over the lazy dog '.repeat(5); // 220 chars -> 2 chunks
    const value = utf8ToBin(text);
    const chunks = splitValueIntoChunks(value);

    // Data NFT 0 commitment: a=7, b$len=value.length. Built via the same codec the reader decodes.
    const dataCommitment = buildPushdataCommitment(
      layout, { a: 7n, b: text }, 0,
    );

    const dataNft: Utxo = {
      txid: 'dd'.repeat(32),
      vout: 0,
      satoshis: 1000n,
      token: { amount: 0n, category: categoryId, nft: { capability: 'mutable', commitment: dataCommitment } },
    };
    const master: Utxo = {
      txid: 'ee'.repeat(32),
      vout: 0,
      satoshis: 1000n,
      token: { amount: 0n, category: categoryId, nft: { capability: 'minting', commitment: '' } },
    };
    const chunkUtxos = chunks.map((d, i) => chunkUtxo(i, d, i));

    const dataAddr = 'data-addr';
    const chunkAddr = 'chunk-addr';
    const provider = {
      network: 'mocknet',
      getUtxos: async (addr: string): Promise<Utxo[]> => {
        if (addr === dataAddr) return [master, dataNft];
        if (addr === chunkAddr) return chunkUtxos;
        return [];
      },
    } as any;

    const result = await reader.readStateFromChain(
      provider, categoryId, [dataAddr, chunkAddr], [dataAddr], { b: chunkAddr },
    );
    expect(result.state.a).toBe(7n);
    expect(result.state.b).toBe(text);
    expect(result.state['b$len']).toBeUndefined();
  });

  it('returns empty string for A$len 0 with no chunks', async () => {
    const dataCommitment = buildPushdataCommitment(
      layout, { a: 0n, b: '' }, 0,
    );
    const dataNft: Utxo = {
      txid: 'dd'.repeat(32), vout: 0, satoshis: 1000n,
      token: { amount: 0n, category: categoryId, nft: { capability: 'mutable', commitment: dataCommitment } },
    };
    const provider = {
      network: 'mocknet',
      getUtxos: async (addr: string): Promise<Utxo[]> => (addr === 'd' ? [dataNft] : []),
    } as any;
    const result = await reader.readStateFromChain(provider, categoryId, ['d', 'c'], ['d'], { b: 'c' });
    expect(result.state.b).toBe('');
  });
});
