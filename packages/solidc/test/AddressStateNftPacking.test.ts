import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * An address state variable IS its locking bytecode, stored inline in the NFT commitment. The widest form is
 * P2SH32 (`OP_HASH256 <32> OP_EQUAL` = 35 B), so it occupies 36 bytes pushdata-encoded - not the 9 that the
 * bin-packer used to assume for it.
 *
 * The estimate is what decides how many state variables share one data NFT. At 9 bytes, fourteen addresses
 * looked like they fit in one 128-byte commitment; at send time the real commitment overflowed the consensus
 * limit and the node rejected the transaction. Measured on MistSwap: `SushiMaker` (four contract addresses
 * plus an owner) produced a 171-byte commitment and every one of its 17 tests died in deploy.
 *
 * Nothing catches this later: the limit is enforced by the network, not by the compiler, so an over-packed
 * layout compiles and deploys clean right up to the point a real node sees it.
 */

type Layout = { variables: { name: string; nftIndex: number; fieldIndex: number }[] } | undefined;

/** Max pushdata-encoded width of one address: 35-byte P2SH32 locking bytecode + a 1-byte push prefix. */
const ADDRESS_MAX_ENCODED_BYTES = 36;
const COMMITMENT_LIMIT = 128;

const addressesPerNft = (layout: Layout): number[] => {
  const perNft = new Map<number, number>();
  for (const v of layout?.variables ?? []) perNft.set(v.nftIndex, (perNft.get(v.nftIndex) ?? 0) + 1);
  return [...perNft.entries()].sort((a, b) => a[0] - b[0]).map(([, count]) => count);
};

describe('address state variables are packed at their real commitment width', () => {
  /** Five addresses: 5 * 36 = 180 B, so they cannot share one commitment. */
  const FIVE_ADDRESSES = `
    contract C {
      address a;
      address b;
      address c;
      address d;
      address e;
      function f(address x) public { this.a = x; this.b = x; this.c = x; this.d = x; this.e = x; }
    }`;

  it('spreads addresses across data NFTs instead of overflowing one commitment', () => {
    const layout = compileString(FIVE_ADDRESSES).stateLayout as Layout;
    expect(layout?.variables.map((v) => v.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // Pre-fix all five landed on nftIndex 0 (5 * 9 = 45 "bytes"), which is a 180-byte commitment on-chain.
    expect(addressesPerNft(layout).length).toBeGreaterThan(1);
  });

  it('no data NFT is assigned more addresses than a 128-byte commitment can hold', () => {
    const layout = compileString(FIVE_ADDRESSES).stateLayout as Layout;
    const maxPerNft = Math.floor(COMMITMENT_LIMIT / ADDRESS_MAX_ENCODED_BYTES); // 3
    for (const count of addressesPerNft(layout)) expect(count).toBeLessThanOrEqual(maxPerNft);
  });

  it('three addresses still share one NFT (3 * 36 = 108 B fits)', () => {
    const layout = compileString(`
      contract C {
        address a;
        address b;
        address c;
        function f(address x) public { this.a = x; this.b = x; this.c = x; }
      }`).stateLayout as Layout;
    expect(addressesPerNft(layout)).toEqual([3]);
  });
});
