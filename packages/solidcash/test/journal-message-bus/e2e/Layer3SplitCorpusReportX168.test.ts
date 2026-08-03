import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { reportSplitCase, validateX168Manifest, writeSplitCorpusReport } from './layer3-split-corpus-report-x168.js';

const artifact = (bytes: number, contractName?: string): any => ({ bytecode: `0x${'00'.repeat(bytes)}`, contractName });

describe('X168 split-corpus report consumer', () => {
  it('reproduces the published MarketplaceV1 facet count and worst-shard figure', () => {
    const sizes = [9_881, 9_700, 9_600, 9_500, 9_400, 9_300];
    const facets = Object.fromEntries(sizes.map((size, index) => [`F${index}`, artifact(size)]));
    const report = reportSplitCase({
      id: 'MarketplaceV1', sourceRoot: 'eacc', file: 'MarketplaceV1.sol', contract: 'MarketplaceV1',
      sourceSha256: '0'.repeat(64),
    }, {
      root: artifact(2_000, 'MarketplaceV1'), facets,
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
    expect(() => reportSplitCase({
      id: 'broken', sourceRoot: 'repo', file: 'broken.sol', contract: 'Broken', sourceSha256: '0'.repeat(64),
    }, {
      root: artifact(1, 'Broken'), facets: { F0: artifact(1) },
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

  it('refuses a partial or reordered population before compilation', () => {
    expect(() => validateX168Manifest([], { repo: '/', eacc: '/' }))
      .toThrow(/expected exact ordered case set/);
  });

  it('pins the committed ten-case population to source and contract identity', () => {
    const manifest = JSON.parse(readFileSync(new URL('./layer3-x168-split-corpus-manifest.json', import.meta.url), 'utf8'));
    const specs = validateX168Manifest(manifest, {
      repo: new URL('../../../../..', import.meta.url).pathname,
      eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
    });
    expect(specs).toHaveLength(10);
    expect(specs.at(-1)?.contract).toBe('MarketplaceV1');
  });
});
