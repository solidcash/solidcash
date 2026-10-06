/**
 * The plain path's learning loop judges a callee frame from the composition derived through that frame and no further
 * (`deriveThroughFrame`): the runs before the frame are the one continuous depth-first derivation the whole composition
 * makes, and no run of a frame after it is made. A stub host stands in for the composed one, so each run is counted.
 */
import { describe, expect, it } from 'vitest';
import { FrameKind, type StopSite, type StopSiteMetadata } from '@solidcash/utils';
import {
  type DerivationHost,
  type FrameRequest,
  type StepOutcome,
  FramedComposerError,
  deriveComposition,
} from '../../../src/framed/composer/index.js';
import { deriveThroughFrame } from '../../../src/framed/call/callees.js';

/** The call with ordinal `callIndex`, reached at `site`. */
function call(site: number, callIndex: number): StopSite {
  return { kind: 'call', site, callIndex };
}

/** The close of segment `segmentIndex`, reached at `site`. */
function close(site: number, segmentIndex: number): StopSite {
  return { kind: 'segmentClose', site, segmentIndex };
}

function frame(contract: string, entry: string, master: string, kind: FrameRequest['kind'] = FrameKind.CALL): FrameRequest {
  return { contract, functionName: `${contract}.${entry}()`, kind, master };
}

const ROOT = frame('A', 'f', 'A m1', FrameKind.ROOT);
const B = frame('B', 'g', 'B m1');
const C = frame('C', 'h', 'C m1');
const D = frame('D', 'k', 'D m1');
const PAYEE = frame('P', 'receive', 'P m1', FrameKind.ROOT);

/**
 * A root that calls B and then C, B calling D on its way: each body closes one segment per call and one after them.
 * `stallIn` names a frame whose first run fills nothing, which the driver reads as that frame's stall.
 */
function composition(stallIn?: string): { readonly host: DerivationHost; readonly runs: string[] } {
  const sites: Record<string, StopSiteMetadata> = {
    'A.f()': {
      version: 1, functionName: 'A.f()', sites: [call(0, 0), close(1, 0), call(2, 1), close(3, 1), close(4, 2)],
    },
    'B.g()': { version: 1, functionName: 'B.g()', sites: [call(0, 0), close(1, 0), close(2, 1)] },
    'C.h()': { version: 1, functionName: 'C.h()', sites: [close(0, 0)] },
    'D.k()': { version: 1, functionName: 'D.k()', sites: [close(0, 0)] },
    'P.receive()': { version: 1, functionName: 'P.receive()', sites: [close(0, 0)] },
  };
  const callees: Record<string, FrameRequest> = { 'A m1#0': B, 'A m1#2': C, 'B m1#0': D };
  const runs: string[] = [];
  const host: DerivationHost = {
    sitesFor: (functionName) => sites[functionName]!,
    step: (request, site): StepOutcome => {
      runs.push(`${request.master}@${site.site}`);
      if (request.master === stallIn) return {};
      if (site.kind !== 'call') return { filled: 'segmentRecords' };
      return { filled: 'callResult', callee: callees[`${request.master}#${site.site}`]! };
    },
  };
  return { host, runs };
}

describe('plain path: a callee frame judged from the composition derived through it', () => {
  it('derives the whole composition in the order deriveComposition does when no frame is named', () => {
    const { host, runs } = composition();
    deriveComposition([ROOT], host);
    expect(runs).toEqual([
      'A m1@0', 'B m1@0', 'D m1@0', 'B m1@1', 'B m1@2', 'A m1@1', 'A m1@2', 'C m1@0', 'A m1@3', 'A m1@4',
    ]);
  });

  it('stops once the first callee and its subtree are derived, making no run of the frames after it', () => {
    const { host, runs } = composition();
    expect(deriveThroughFrame([ROOT], host, B.master)).toBe(true);
    expect(runs).toEqual(['A m1@0', 'B m1@0', 'D m1@0', 'B m1@1', 'B m1@2']);
  });

  it('stops a nested frame before its caller resumes', () => {
    const { host, runs } = composition();
    expect(deriveThroughFrame([ROOT], host, D.master)).toBe(true);
    expect(runs).toEqual(['A m1@0', 'B m1@0', 'D m1@0']);
  });

  it('derives every frame before a later callee exactly as the whole composition does', () => {
    const scoped = composition();
    const whole = composition();
    expect(deriveThroughFrame([ROOT], scoped.host, C.master)).toBe(true);
    deriveComposition([ROOT], whole.host);
    // The root's own closes after the call are the runs left out.
    expect(scoped.runs).toEqual(whole.runs.slice(0, -2));
    expect(scoped.runs.length).toBeLessThan(whole.runs.length);
  });

  it('derives the frames listed before the root first, as the whole composition does', () => {
    const { host, runs } = composition();
    expect(deriveThroughFrame([PAYEE, ROOT], host, B.master)).toBe(true);
    expect(runs).toEqual(['P m1@0', 'A m1@0', 'B m1@0', 'D m1@0', 'B m1@1', 'B m1@2']);
  });

  it('counts a frame whose own derivation stalls as derived, and stops before its caller resumes', () => {
    const { host, runs } = composition(D.master);
    const stalls: string[] = [];
    const reached = deriveThroughFrame([ROOT], host, B.master, {
      onCalleeStall: (callee) => {
        stalls.push(callee.master);
      },
    });
    expect(reached).toBe(true);
    expect(stalls).toEqual([D.master]);
    expect(runs).toEqual(['A m1@0', 'B m1@0', 'D m1@0', 'B m1@1', 'B m1@2']);
  });

  it('derives everything and reports false for a frame the derivation never enters', () => {
    const { host, runs } = composition();
    expect(deriveThroughFrame([ROOT], host, 'E m1')).toBe(false);
    expect(runs).toHaveLength(10);
  });

  it('rethrows a stall of the root before the frame is entered', () => {
    const { host } = composition(ROOT.master);
    expect(() => deriveThroughFrame([ROOT], host, C.master)).toThrow(FramedComposerError);
  });
});
