import { describe, expect, it } from 'vitest';
import {
  countStopSites,
  describeStopSite,
  nextStopSite,
  validateStopSiteMetadata,
  witnessKindOf,
} from '../../src/framed/index.js';
import type { StopSiteMetadata } from '../../src/framed/stop-site.js';
import { expectFramedRejection } from './helpers.js';

const metadata = (sites: StopSiteMetadata['sites']): StopSiteMetadata => ({
  version: 1,
  functionName: 'f',
  sites,
});

const coherent = metadata([
  { kind: 'read', site: 0, record: 'DA' },
  { kind: 'call', site: 1, callIndex: 0 },
  { kind: 'segmentClose', site: 2, segmentIndex: 0 },
  { kind: 'read', site: 3, record: 'DB' },
  { kind: 'call', site: 4, callIndex: 1 },
  { kind: 'segmentClose', site: 5, segmentIndex: 1 },
  { kind: 'segmentClose', site: 6, segmentIndex: 2 },
]);

describe('stop-site metadata validation', () => {
  it('accepts a coherent execution with two calls, three segment closes and interleaved reads', () => {
    expect(() => validateStopSiteMetadata(coherent)).not.toThrow();
  });

  it('accepts an execution with no calls and one segment close', () => {
    expect(() => validateStopSiteMetadata(metadata([{ kind: 'segmentClose', site: 0, segmentIndex: 0 }])))
      .not.toThrow();
  });

  it('rejects a version other than the current one', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata({ ...coherent, version: 2 as unknown as 1 }),
      /unsupported stop-site metadata version/,
    );
  });

  it('rejects a gap in the site ordinals', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'read', site: 0, record: 'DA' },
        { kind: 'read', site: 2, record: 'DB' },
      ])),
      /reports ordinal/,
    );
  });

  it('rejects a repeated site ordinal', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'read', site: 0, record: 'DA' },
        { kind: 'read', site: 0, record: 'DB' },
      ])),
      /reports ordinal/,
    );
  });

  it('rejects a segment close before the call it closes', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'read', site: 0, record: 'DA' },
        { kind: 'segmentClose', site: 1, segmentIndex: 1 },
        { kind: 'call', site: 2, callIndex: 0 },
        { kind: 'segmentClose', site: 3, segmentIndex: 0 },
      ])),
      /closes before call 0/,
    );
  });

  it('rejects the wrong number of segment closes', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'call', site: 0, callIndex: 0 },
        { kind: 'segmentClose', site: 1, segmentIndex: 0 },
      ])),
      /one more segment than calls|closes 2 segment/,
    );
  });

  it('rejects duplicate call indices', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'call', site: 0, callIndex: 0 },
        { kind: 'call', site: 1, callIndex: 0 },
        { kind: 'segmentClose', site: 2, segmentIndex: 0 },
        { kind: 'segmentClose', site: 3, segmentIndex: 1 },
      ])),
      /two call sites report call index 0/,
    );
  });

  it('rejects call indices that are not contiguous', () => {
    expectFramedRejection(
      () => validateStopSiteMetadata(metadata([
        { kind: 'call', site: 0, callIndex: 1 },
        { kind: 'call', site: 1, callIndex: 2 },
        { kind: 'segmentClose', site: 2, segmentIndex: 0 },
        { kind: 'segmentClose', site: 3, segmentIndex: 1 },
        { kind: 'segmentClose', site: 4, segmentIndex: 2 },
      ])),
      /call indices are not contiguous/,
    );
  });
});

describe('stop-site helpers', () => {
  it('counts sites of one kind', () => {
    expect(countStopSites(coherent, 'read')).toBe(2);
    expect(countStopSites(coherent, 'call')).toBe(2);
    expect(countStopSites(coherent, 'segmentClose')).toBe(3);
  });

  it('returns the next site after an ordinal, or nothing past the last one', () => {
    expect(nextStopSite(coherent, 0)).toEqual({ kind: 'call', site: 1, callIndex: 0 });
    expect(nextStopSite(coherent, -1)).toEqual({ kind: 'read', site: 0, record: 'DA' });
    expect(nextStopSite(coherent, 6)).toBeUndefined();
  });

  it('describes a site', () => {
    expect(describeStopSite({ kind: 'read', site: 0, record: 'DA' })).toBe('read of DA');
    expect(describeStopSite({ kind: 'call', site: 1, callIndex: 3 })).toBe('call 3');
    expect(describeStopSite({ kind: 'segmentClose', site: 2, segmentIndex: 2 })).toBe('close of segment 2');
  });

  it('names the witness a site needs filled', () => {
    expect(witnessKindOf({ kind: 'read', site: 0, record: 'DA' })).toBe('recordCommitment');
    expect(witnessKindOf({ kind: 'call', site: 1, callIndex: 0 })).toBe('callResult');
    expect(witnessKindOf({ kind: 'segmentClose', site: 2, segmentIndex: 0 })).toBe('segmentRecords');
  });
});
