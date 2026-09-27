/**
 * Stop-site metadata.
 *
 * A function's compiled form publishes where its execution depends on a witness it does not yet have, so a builder
 * can run the program, stop at the first missing witness, fill it, and resume from the same place. Three kinds are
 * published:
 *
 *   - a state read, with the record it reads, so the builder can supply that record's commitment;
 *   - an external call, with its index, so the builder can derive the callee and record what it returned;
 *   - a segment close, so the builder can compare the records a segment computed with the ones it declared.
 *
 * Every step must fill a witness at one of these sites. A step that fills none is refused rather than retried, and
 * because each step fills a witness of one execution bounded by the provider's operation budget, the number of
 * steps is bounded without a configured cap.
 */

import { PerCallEncodingError } from './primitives.js';

/** The three places an execution can need a witness it does not have. */
export type StopSiteKind = 'read' | 'call' | 'segmentClose';

/** A state read: which record the execution read. */
export interface ReadStopSite {
  kind: 'read';
  /** Position of this site in the function's execution order. */
  site: number;
  /** The record read, by its compiler-authored identity within the function's footprint. */
  record: string;
}

/** An external call: which call the execution made. */
export interface CallStopSite {
  kind: 'call';
  site: number;
  /** Ordinal of the call within this execution, matching the call record it produces. */
  callIndex: number;
  /**
   * True when the source does not fix whether this call runs, so an execution may reach the site with nothing to
   * fill: the arms of a branch each name a call at the same ordinal, and the one that runs is the one there is.
   */
  conditional?: boolean;
  /**
   * Which call of the source this site names, when a driver resolves a callee through a table of the caller's own
   * calls. Two mutually exclusive arms name one ordinal, so the ordinal alone does not identify the call: a driver
   * that looks a callee up needs the source's own index, and one that fills the record needs the ordinal.
   */
  descriptor?: number;
}

/** A segment close: which segment's computed records must be compared with the declared ones. */
export interface SegmentCloseStopSite {
  kind: 'segmentClose';
  site: number;
  /** Ordinal of the segment being closed, starting at zero. */
  segmentIndex: number;
}

/** One published site. */
export type StopSite = ReadStopSite | CallStopSite | SegmentCloseStopSite;

/** The site metadata a function publishes. */
export interface StopSiteMetadata {
  version: 1;
  /** The function this metadata describes. */
  functionName: string;
  /** Sites in the order the execution reaches them. */
  sites: StopSite[];
}

/** The current schema version. */
export const STOP_SITE_METADATA_VERSION = 1;

/** Counts the sites of one kind. */
export function countStopSites(metadata: StopSiteMetadata, kind: StopSiteKind): number {
  return metadata.sites.filter((site) => site.kind === kind).length;
}

/**
 * Checks that the published sites form a coherent execution: ordinals run from zero without gaps, each call site has
 * a distinct index, and the segment closes partition the execution the way the wire format requires — one close per
 * call plus one for the return.
 */
export function validateStopSiteMetadata(metadata: StopSiteMetadata): void {
  if (metadata.version !== STOP_SITE_METADATA_VERSION) {
    throw new PerCallEncodingError(`unsupported stop-site metadata version: ${String(metadata.version)}`);
  }
  metadata.sites.forEach((site, index) => {
    if (site.site !== index) {
      throw new PerCallEncodingError(`stop site ${index} reports ordinal ${site.site}`);
    }
  });

  // A call index is a record of the execution, so two sites may report the same one only when the source fixes
  // neither of them: the arms of a branch each name a call at the same position, and the one that ran is the one
  // whose witness there is. Everything else has to be a distinct record.
  const callIndices = new Set<number>();
  const conditionalIndices = new Set<number>();
  const segmentIndices = new Set<number>();
  for (const site of metadata.sites) {
    if (site.kind === 'call') {
      if (!callIndices.has(site.callIndex)) {
        callIndices.add(site.callIndex);
        if (site.conditional === true) conditionalIndices.add(site.callIndex);
      } else if (site.conditional !== true || !conditionalIndices.has(site.callIndex)) {
        throw new PerCallEncodingError(`two call sites report call index ${site.callIndex}`);
      }
    } else if (site.kind === 'segmentClose') {
      if (segmentIndices.has(site.segmentIndex)) {
        throw new PerCallEncodingError(`two segment closes report segment ${site.segmentIndex}`);
      }
      segmentIndices.add(site.segmentIndex);
    }
  }

  const callCount = callIndices.size;
  for (let index = 0; index < callCount; index += 1) {
    if (!callIndices.has(index)) {
      throw new PerCallEncodingError(`call indices are not contiguous: ${index} is missing`);
    }
  }
  const expectedSegments = callCount + 1;
  if (segmentIndices.size !== expectedSegments) {
    throw new PerCallEncodingError(
      `an execution with ${callCount} call(s) closes ${expectedSegments} segment(s): got ${segmentIndices.size}`,
    );
  }
  for (let index = 0; index < expectedSegments; index += 1) {
    if (!segmentIndices.has(index)) {
      throw new PerCallEncodingError(`segment indices are not contiguous: ${index} is missing`);
    }
  }

  // A segment close that carries an ordinal k must appear after the call it closes, so the segment's records are
  // compared only once the call that ended it has returned.
  const seenCalls = new Set<number>();
  for (const site of metadata.sites) {
    if (site.kind === 'call') {
      seenCalls.add(site.callIndex);
    } else if (site.kind === 'segmentClose' && site.segmentIndex > 0) {
      if (!seenCalls.has(site.segmentIndex - 1)) {
        throw new PerCallEncodingError(
          `segment ${site.segmentIndex} closes before call ${site.segmentIndex - 1} is made`,
        );
      }
    }
  }
}

/** The next site after `afterOrdinal`, or `undefined` when the execution has no further stop sites. */
export function nextStopSite(metadata: StopSiteMetadata, afterOrdinal: number): StopSite | undefined {
  return metadata.sites.find((site) => site.site > afterOrdinal);
}

/** A one-line description of a site, for diagnostics. */
export function describeStopSite(site: StopSite): string {
  switch (site.kind) {
    case 'read': return `read of ${site.record}`;
    case 'call': return `call ${site.callIndex}`;
    case 'segmentClose': return `close of segment ${site.segmentIndex}`;
  }
}

/** The witness a site needs filled: a record commitment, a call result, or a segment's computed records. */
export type StopSiteWitnessKind = 'recordCommitment' | 'callResult' | 'segmentRecords';

/** What a site asks the builder to supply. */
export function witnessKindOf(site: StopSite): StopSiteWitnessKind {
  switch (site.kind) {
    case 'read': return 'recordCommitment';
    case 'call': return 'callResult';
    case 'segmentClose': return 'segmentRecords';
  }
}
