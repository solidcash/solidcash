import { describe, expect, it } from 'vitest';
import { reportSplitCase, writeSplitCorpusReport } from './layer3-split-corpus-report-x168.js';

const artifact = (bytes: number): any => ({ bytecode: `0x${'00'.repeat(bytes)}` });

describe('X168 split-corpus report consumer', () => {
  it('reproduces the published MarketplaceV1 facet count and worst-shard figure', () => {
    const sizes = [9_881, 9_700, 9_600, 9_500, 9_400, 9_300];
    const facets = Object.fromEntries(sizes.map((size, index) => [`F${index}`, artifact(size)]));
    const report = reportSplitCase({ id: 'MarketplaceV1', file: 'MarketplaceV1.sol' }, {
      root: artifact(2_000), facets,
      manifest: {
        facets: sizes.map((size, index) => ({ name: `F${index}`, estimatedRedeemBytes: size })),
        routes: sizes.map((_, index) => ({ function: `f${index}`, target: `F${index}` })),
      },
    });
    expect(report.facetCount).toBe(6);
    expect(Math.max(...report.facets.map((facet: any) => facet.estimatedRedeemBytes))).toBe(9_881);
    expect(report.facets[1].functions).toEqual(['f1']);
  });

  it('fails loudly when membership cannot be attributed to a real facet', () => {
    expect(() => reportSplitCase({ id: 'broken', file: 'broken.sol' }, {
      root: artifact(1), facets: { F0: artifact(1) },
      manifest: {
        facets: [{ name: 'F0', estimatedRedeemBytes: 1 }],
        routes: [{ function: 'lost', target: 'F9' }],
      },
    })).toThrow(/X168 attribution refusal.*unknown target F9/);
  });

  it('cannot overwrite a committed numeric pin', () => {
    expect(() => writeSplitCorpusReport('packages/solidc/docs/split.json', [{}]))
      .toThrow(/must be an absolute \/tmp path/);
  });
});
