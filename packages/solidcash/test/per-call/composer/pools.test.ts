import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  type StopSite,
  type StopSiteMetadata,
} from '@solidcash/utils';
import {
  type CompositionGroup,
  type DerivationHost,
  type FrameRequest,
  CompositionPools,
  PerCallComposerError,
  deriveComposition,
  layoutTransaction,
  selectGroupValidators,
} from '../../../src/per-call/composer/index.js';

/** Runs `body` and returns the refusal it raised. */
function captureRefusal(body: () => unknown): PerCallComposerError {
  try {
    body();
  } catch (error) {
    if (error instanceof PerCallComposerError) return error;
    throw error;
  }
  throw new Error('expected a refusal, but nothing was raised');
}

/** The witness a site asks for. */
function witnessFor(site: StopSite): 'recordCommitment' | 'callResult' | 'segmentRecords' {
  switch (site.kind) {
    case 'read': return 'recordCommitment';
    case 'call': return 'callResult';
    case 'segmentClose': return 'segmentRecords';
  }
}

describe('master pool exhaustion', () => {
  it('fills a pool exactly, then refuses the next entry naming the contract, the entries needed and the size', () => {
    const pools = new CompositionPools({ masters: { Unicrow: ['U m1', 'U m2'] }, validators: {} });

    expect(pools.takeMaster('Unicrow')).toBe('U m1');
    expect(pools.takeMaster('Unicrow')).toBe('U m2');

    const refusal = captureRefusal(() => pools.takeMaster('Unicrow'));

    expect(refusal.code).toBe('PER_CALL_POOL_EXHAUSTED');
    expect(refusal.message).toContain('Unicrow');
    expect(refusal.message).toContain('3');
    expect(refusal.message).toContain('2');
  });

  it('refuses a composition that needs one more entry than a pool holds, before anything is built', () => {
    const pools = new CompositionPools({ masters: { A: ['A m1'], B: ['B m1'] }, validators: {} });
    // B.g runs on B's only master and calls B.h, which needs a second entry into B.
    const sites: Record<string, StopSiteMetadata> = {
      'A.f()': {
        version: 1,
        functionName: 'A.f()',
        sites: [
          { kind: 'call', site: 0, callIndex: 0 },
          { kind: 'segmentClose', site: 1, segmentIndex: 0 },
          { kind: 'segmentClose', site: 2, segmentIndex: 1 },
        ],
      },
      'B.g()': {
        version: 1,
        functionName: 'B.g()',
        sites: [
          { kind: 'call', site: 0, callIndex: 0 },
          { kind: 'segmentClose', site: 1, segmentIndex: 0 },
          { kind: 'segmentClose', site: 2, segmentIndex: 1 },
        ],
      },
      'B.h()': {
        version: 1,
        functionName: 'B.h()',
        sites: [
          { kind: 'read', site: 0, record: 'DB' },
          { kind: 'segmentClose', site: 1, segmentIndex: 0 },
        ],
      },
    };
    const host: DerivationHost = {
      sitesFor: (functionName) => sites[functionName]!,
      step: (request, site) => {
        if (site.kind !== 'call') return { filled: witnessFor(site) };
        const callee = request.functionName === 'A.f()' ? 'B.g()' : 'B.h()';
        return {
          filled: 'callResult',
          callee: { contract: 'B', functionName: callee, kind: FrameKind.CALL, master: pools.takeMaster('B') },
        };
      },
    };
    const root: FrameRequest = {
      contract: 'A',
      functionName: 'A.f()',
      kind: FrameKind.ROOT,
      master: pools.takeMaster('A'),
    };
    let built = 0;
    const build = (): void => { built += 1; };

    const refusal = captureRefusal(() => {
      deriveComposition([root], host);
      build();
      layoutTransaction([{ contract: 'A', masters: pools.mastersTaken('A'), state: [] }]);
    });

    expect(refusal.code).toBe('PER_CALL_POOL_EXHAUSTED');
    expect(refusal.message).toContain('"B"');
    expect(refusal.message).toContain('2');
    expect(refusal.message).toContain('1');
    expect(built).toBe(0);
  });
});

describe('validator selection', () => {
  it('gives disjoint groups their own validator, covering every master and settling multi-master contracts', () => {
    const pools = new CompositionPools({
      masters: {},
      validators: { A: ['V_A1'], C: ['V_C1'] },
    });
    const groups: readonly CompositionGroup[] = [
      {
        firstRootContract: 'A',
        masters: [
          { contract: 'A', master: 'A m1' },
          { contract: 'A', master: 'A m2' },
          { contract: 'B', master: 'B m1' },
        ],
      },
      { firstRootContract: 'C', masters: [{ contract: 'C', master: 'C m1' }, { contract: 'D', master: 'D m1' }] },
    ];

    const placements = selectGroupValidators(groups, pools);

    expect(placements).toEqual([
      { block: 'A', validator: 'V_A1', covers: ['A', 'B'], settles: ['A'] },
      { block: 'C', validator: 'V_C1', covers: ['C', 'D'], settles: [] },
    ]);
  });

  it('gives two disjoint groups rooted at one contract two validators of that contract', () => {
    const pools = new CompositionPools({
      masters: {},
      validators: { A: ['V_A1', 'V_A2'] },
    });

    const placements = selectGroupValidators([
      { firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m1' }] },
      { firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m2' }] },
    ], pools);

    expect(placements).toEqual([
      { block: 'A', validator: 'V_A1', covers: ['A'], settles: [] },
      { block: 'A', validator: 'V_A2', covers: ['A'], settles: [] },
    ]);
  });

  it('refuses a composition whose first root has no validator, naming the contract', () => {
    const pools = new CompositionPools({ masters: {}, validators: {} });
    let built = 0;

    const refusal = captureRefusal(() => {
      selectGroupValidators([{ firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m1' }] }], pools);
      built += 1;
    });

    expect(refusal.code).toBe('PER_CALL_POOL_EXHAUSTED');
    expect(refusal.message).toContain('A');
    expect(refusal.message).toContain('no validator');
    expect(built).toBe(0);
  });

  it('refuses a second group when the first root contract has only one validator', () => {
    const pools = new CompositionPools({ masters: {}, validators: { A: ['V_A1'] } });

    const refusal = captureRefusal(() => selectGroupValidators([
      { firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m1' }] },
      { firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m2' }] },
    ], pools));

    expect(refusal.code).toBe('PER_CALL_POOL_EXHAUSTED');
    expect(refusal.message).toContain('A');
    expect(refusal.message).toContain('no validator');
  });

  it('refuses groups that share a master, because their validators could not be separate', () => {
    const pools = new CompositionPools({ masters: {}, validators: { A: ['V_A1'], C: ['V_C1'] } });

    expect(() => selectGroupValidators([
      { firstRootContract: 'A', masters: [{ contract: 'A', master: 'A m1' }] },
      {
        firstRootContract: 'C',
        masters: [{ contract: 'A', master: 'A m1' }, { contract: 'C', master: 'C m1' }],
      },
    ], pools)).toThrowError(/two groups/);
  });
});
