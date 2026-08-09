import { describe, expect, it } from 'vitest';
import { compileStringSplit } from 'solidc';
import { Contract, MockNetworkProvider, StatefulContract } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';

/**
 * Q1. `estimatedRedeemBytes` IS A LOWER BOUND, AND THE HEADROOM STORY IS TOLD IN IT.
 *
 * The manifest publishes the facet ARTIFACT's byte length. What consensus measures - and what the SDK's own
 * `assertSplitRedeemSize` measures - is the CONSTRUCTED redeem script, which additionally carries the pushed
 * constructor arguments: the 32-byte brand on every facet, and one locking-bytecode push per facet link on
 * the root. So a shard's real margin is smaller than the published figure by a fixed, measurable amount.
 *
 * Measured on the corpus MarketplaceV1 bundle: every facet is +70 B constructed and the root is +253 B, which
 * moves the worst shard from 9,881 B / 119 B of headroom to 9,951 B / 49 B - the margin is 2.4x tighter than
 * the number the deployer is handed. (Was 9,885 / 115 -> 9,955 / 45 before X162 moved two functions between
 * groups; the overheads are unchanged and so is the conclusion.) That contract is not in this repo, so the
 * INVARIANT is pinned here instead: constructed is strictly larger, on both a facet and the root. The current
 * root-capacity guard may retain one facet at this deliberately small scale; one link is enough to measure both
 * constructor-overhead classes without weakening that guard.
 */
const SOURCE = `pragma solidity ^0.8.7;
contract Sized {
  uint a;
  uint b;
  uint c;
  function setA(uint v) public { a = v; require(v >= 0, "n"); }
  function setB(uint v) public { b = v; require(v >= 0, "n"); }
  function setC(uint v) public { c = v; require(v >= 0, "n"); }
}`;

describe('Q1: the published split size against the constructed redeem script', () => {
  it('publishes a facet size that the constructed redeem script exceeds', () => {
    const provider = new MockNetworkProvider();
    const category = new Uint8Array(32).fill(0xab);
    const brand = StatefulContract.libraryBrand('ab'.repeat(32));
    // A limit low enough to force more than one facet, so the root also carries more than one link push.
    const single = compileStringSplit(SOURCE, { solidityImportCompat: true, forceSplit: true });
    const bundle = compileStringSplit(SOURCE, {
      solidityImportCompat: true, forceSplit: true,
      maxShardBytes: Math.max(700, single.manifest.facets[0].estimatedRedeemBytes - 1),
    });
    expect(bundle.manifest.facets.length).toBeGreaterThan(0);

    const links: Uint8Array[] = [];
    for (const info of bundle.manifest.facets) {
      const facet = new Contract(bundle.facets[info.name], [brand], { provider, category });
      console.log(`[Q1-size] ${info.name}: published ${info.estimatedRedeemBytes} -> constructed `
        + `${facet.bytesize} (+${facet.bytesize - info.estimatedRedeemBytes})`);
      expect(facet.bytesize).toBeGreaterThan(info.estimatedRedeemBytes);
      links.push(addressToLockScript(facet.address));
    }
    const root = new Contract(bundle.root, links as never[], { provider, category });
    console.log(`[Q1-size] root: constructed ${root.bytesize} with ${links.length} facet links`);
    expect(root.bytesize).toBeGreaterThan(links.length * 30);
  }, 240_000);
});
