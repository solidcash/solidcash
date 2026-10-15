/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { compileStringMulti } from '../direct-compile.js';

// The vendored MistSwap UniswapV2Factory/UniswapV2Pair source, compiled fresh with the current compiler
// (evmCompat + split). This pins the COMPILE surface for the literal UniswapV2Factory.createPair shape: the
// typed pair deploy target, the dual-direction getPair entry accesses, the create2 salt, the folded initialize,
// and the deployDataNft child-data reservation. The end-to-end deployFrom run of this full shape still has an
// SDK gap (see the plan); the runnable equivalent is pinned by CreatePairDeployVMap.test.ts.
const SOURCE = readFileSync(new URL('../fixture/UniswapV2.scash', import.meta.url), 'utf8');

describe('UniswapV2Factory.createPair (vendored source, fresh compile)', () => {
  const artifacts = compileStringMulti(SOURCE, {
    evmCompat: true, split: 'size', allowUnsafeOperations: true,
  });
  const factoryArtifact = artifacts.UniswapV2Factory;
  const childArtifact = artifacts.UniswapV2Pair;

  it('layout: createPair deploys a typed pair and writes both getPair directions', () => {
    const createPair = factoryArtifact.abi.find((f) => f.name === 'createPair')!;
    expect(createPair.modifiers).toContain('deploy');
    expect(createPair.deployTargets?.[0]).toMatchObject({ contractName: 'UniswapV2Pair' });
    expect(createPair.deployTargets?.[0]?.salt).toMatchObject({ computed: true });
    expect(createPair.deployTargets?.[0]?.dataNftCount).toBe(childArtifact.stateLayout!.dataNftCount);
    expect(createPair.deployTargets?.[0]?.hasFoldedChildCall).toBe(true);
    expect(createPair.entryAccesses).toHaveLength(2);
    expect(createPair.entryAccesses?.map((e) => e.collection)).toEqual(['getPair', 'getPair']);
    expect(createPair.sortedBatchInfo?.[0]).toMatchObject({ collection: 'getPair', linear: true });
    expect(createPair.blockLayout?.slots.some((s) => s.kind === 'deployDataNft')).toBe(true);
    expect(childArtifact.stateLayout?.dataNftCount).toBeGreaterThan(0);
  });
});
