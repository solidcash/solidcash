import { describe, expect, it } from 'vitest';
import type { StateLayout } from '../src/artifact.js';
import { buildPushdataCommitment, buildPushdataCommitmentKeeping } from '../src/state.js';

const layout: StateLayout = {
  variables: [
    { name: 'who', type: 'address', nftIndex: 0, fieldIndex: 0 },
    { name: 'n', type: 'uint256', nftIndex: 0, fieldIndex: 1 },
  ],
  dataNftCount: 1,
  commitmentLimit: 128,
};
const ZERO = '00'.repeat(20);
/** The record a covenant writes after storing a refused recovery's answer: who = 20 zero bytes, n = 1. */
const STORED = `14${ZERO}51`;

describe('a record rebuilt from its values keeps the bytes a record holds for each value left as it was', () => {
  it('keeps the 20-byte zero address, which the SDK writes as the empty push, and writes a changed value', () => {
    const values = { who: new Uint8Array(20), n: 2n };
    expect(buildPushdataCommitment(layout, values, 0)).toBe('0052');
    expect(buildPushdataCommitmentKeeping(layout, values, 0, [STORED])).toBe(`14${ZERO}52`);
    expect(buildPushdataCommitmentKeeping(layout, { who: new Uint8Array(20), n: 1n }, 0, [STORED])).toBe(STORED);
  });

  it('takes the first record that holds a value and skips one that is not a record of the NFT', () => {
    const values = { who: new Uint8Array(20), n: 1n };
    expect(buildPushdataCommitmentKeeping(layout, values, 0, ['0051', STORED])).toBe('0051');
    expect(buildPushdataCommitmentKeeping(layout, values, 0, [undefined, '', '51', `${STORED}ff`, STORED]))
      .toBe(STORED);
    expect(buildPushdataCommitmentKeeping(layout, values, 0, [])).toBe(buildPushdataCommitment(layout, values, 0));
  });

  it('writes the index tag and skips a record of another NFT index', () => {
    const tagged: StateLayout = {
      variables: [{ name: 'who', type: 'address', nftIndex: 0, fieldIndex: 0 }],
      dataNftCount: 1,
      commitmentLimit: 128,
      taggedDataNfts: true,
    };
    const values = { who: new Uint8Array(20) };
    expect(buildPushdataCommitmentKeeping(tagged, values, 0, [`0014${ZERO}`])).toBe(`0014${ZERO}`);
    expect(buildPushdataCommitmentKeeping(tagged, values, 0, [`5114${ZERO}`])).toBe('0000');
  });
});
