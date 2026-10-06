import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  type StopSite,
  type StopSiteMetadata,
  type StopSiteWitnessKind,
} from '@solidcash/utils';
import {
  type DerivationHost,
  type FrameRequest,
  type StepOutcome,
  PerCallComposerError,
  deriveComposition,
  deriveDepthFirst,
} from '../../../src/per-call/composer/index.js';

/** A state read at `site`, of the record `record`. */
function read(site: number, record: string): StopSite {
  return { kind: 'read', site, record };
}

/** The call with ordinal `callIndex`, reached at `site`. */
function call(site: number, callIndex: number): StopSite {
  return { kind: 'call', site, callIndex };
}

/** The close of segment `segmentIndex`, reached at `site`. */
function close(site: number, segmentIndex: number): StopSite {
  return { kind: 'segmentClose', site, segmentIndex };
}

/** The witness a site asks for, so a stub step can report that it filled exactly this one. */
function witnessFor(site: StopSite): StopSiteWitnessKind {
  switch (site.kind) {
    case 'read': return 'recordCommitment';
    case 'call': return 'callResult';
    case 'segmentClose': return 'segmentRecords';
  }
}

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

describe('derivation driver', () => {
  it('fills each stop site with exactly one run, in order, without restarting', () => {
    const metadata: StopSiteMetadata = {
      version: 1,
      functionName: 'A.k()',
      sites: [read(0, 'DA'), read(1, 'DA'), close(2, 0)],
    };
    const root: FrameRequest = { contract: 'A', functionName: 'A.k()', kind: FrameKind.ROOT, master: 'A m1' };
    const ordinals: number[] = [];
    const masters: string[] = [];
    const host: DerivationHost = {
      sitesFor: () => metadata,
      step: (request, site) => {
        ordinals.push(site.site);
        masters.push(request.master);
        return { filled: witnessFor(site) };
      },
    };

    const result = deriveDepthFirst(root, host);

    expect(result.runs).toHaveLength(metadata.sites.length);
    expect(ordinals).toEqual([0, 1, 2]);
    expect(masters).toEqual(['A m1', 'A m1', 'A m1']);
    expect(result.completed).toEqual([root]);
  });

  it('requires one run per stop site, never revisiting a site', () => {
    const metadata: StopSiteMetadata = {
      version: 1,
      functionName: 'A.f()',
      sites: [read(0, 'DA'), read(1, 'DA'), read(2, 'DA'), close(3, 0)],
    };
    const root: FrameRequest = { contract: 'A', functionName: 'A.f()', kind: FrameKind.ROOT, master: 'A m1' };
    let runs = 0;
    const ordinals: number[] = [];
    const host: DerivationHost = {
      sitesFor: () => metadata,
      step: (_request, site) => {
        runs += 1;
        ordinals.push(site.site);
        return { filled: witnessFor(site) };
      },
    };

    deriveDepthFirst(root, host);

    expect(runs).toBe(metadata.sites.length);
    expect(ordinals).toEqual(metadata.sites.map((site) => site.site));
  });

  it('derives a re-entrant chain depth-first, with the callee completing before its caller', () => {
    const sites: Record<string, StopSiteMetadata> = {
      'A.f()': { version: 1, functionName: 'A.f()', sites: [read(0, 'DA'), call(1, 0), close(2, 0), close(3, 1)] },
      'B.g()': { version: 1, functionName: 'B.g()', sites: [call(0, 0), close(1, 0), close(2, 1)] },
      'A.k()': { version: 1, functionName: 'A.k()', sites: [read(0, 'DA'), close(1, 0)] },
    };
    // The re-entry: A.f calls B.g, and B.g's execution calls back into A, which lands on a second A master.
    const callees: Record<string, FrameRequest> = {
      'A.f()#1': { contract: 'B', functionName: 'B.g()', kind: FrameKind.CALL, master: 'B m1' },
      'B.g()#0': { contract: 'A', functionName: 'A.k()', kind: FrameKind.CALL, master: 'A m2' },
    };
    const root: FrameRequest = { contract: 'A', functionName: 'A.f()', kind: FrameKind.ROOT, master: 'A m1' };
    const host: DerivationHost = {
      sitesFor: (functionName) => sites[functionName]!,
      step: (request, site): StepOutcome => {
        if (site.kind !== 'call') return { filled: witnessFor(site) };
        return { filled: 'callResult', callee: callees[`${request.functionName}#${site.site}`]! };
      },
    };

    const result = deriveDepthFirst(root, host);

    expect(result.runs.map((run) => [run.frame.functionName, run.site.site])).toEqual([
      ['A.f()', 0],
      ['A.f()', 1],
      ['B.g()', 0],
      ['A.k()', 0],
      ['A.k()', 1],
      ['B.g()', 1],
      ['B.g()', 2],
      ['A.f()', 2],
      ['A.f()', 3],
    ]);
    // A.k completes inside B.g's execution, and B.g inside A.f's, so every callee is finished before its caller.
    expect(result.completed.map((frame) => frame.functionName)).toEqual(['A.k()', 'B.g()', 'A.f()']);
    expect(result.completed.map((frame) => frame.master)).toEqual(['A m2', 'B m1', 'A m1']);
  });

  it('derives every root of a composition in order through one host', () => {
    const sites: Record<string, StopSiteMetadata> = {
      'A.x()': { version: 1, functionName: 'A.x()', sites: [read(0, 'DA'), close(1, 0)] },
      'C.y()': { version: 1, functionName: 'C.y()', sites: [read(0, 'DC'), close(1, 0)] },
    };
    const roots: FrameRequest[] = [
      { contract: 'A', functionName: 'A.x()', kind: FrameKind.ROOT, master: 'A m1' },
      { contract: 'C', functionName: 'C.y()', kind: FrameKind.ROOT, master: 'C m1' },
    ];
    const host: DerivationHost = {
      sitesFor: (functionName) => sites[functionName]!,
      step: (_request, site) => ({ filled: witnessFor(site) }),
    };

    const result = deriveComposition(roots, host);

    expect(result.runs.map((run) => [run.frame.functionName, run.site.site])).toEqual([
      ['A.x()', 0], ['A.x()', 1], ['C.y()', 0], ['C.y()', 1],
    ]);
    expect(result.completed).toEqual(roots);
  });

  it('refuses a step that fills no witness, naming the master, function and stop site', () => {
    const metadata: StopSiteMetadata = {
      version: 1,
      functionName: 'A.k()',
      sites: [read(0, 'DA'), close(1, 0)],
    };
    const root: FrameRequest = { contract: 'A', functionName: 'A.k()', kind: FrameKind.ROOT, master: 'A m1' };
    const host: DerivationHost = {
      sitesFor: () => metadata,
      step: () => ({}),
    };

    const refusal = captureRefusal(() => deriveDepthFirst(root, host));

    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toContain('A m1');
    expect(refusal.message).toContain('A.k()');
    expect(refusal.message).toContain('site 0');
    expect(refusal.message).toContain('read of DA');
  });

  it('refuses a call step that names no callee', () => {
    const metadata: StopSiteMetadata = {
      version: 1,
      functionName: 'A.f()',
      sites: [call(0, 0), close(1, 0), close(2, 1)],
    };
    const root: FrameRequest = { contract: 'A', functionName: 'A.f()', kind: FrameKind.ROOT, master: 'A m1' };
    const host: DerivationHost = {
      sitesFor: () => metadata,
      step: (_request, site) => ({ filled: witnessFor(site) }),
    };

    const refusal = captureRefusal(() => deriveDepthFirst(root, host));

    expect(refusal.code).toBe('PER_CALL_DERIVATION_STALLED');
    expect(refusal.message).toContain('call 0');
  });
});
