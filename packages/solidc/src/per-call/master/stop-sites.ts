/**
 * Publishing where a master's execution will need a witness it does not yet have.
 *
 * A builder cannot run a master to completion until it has gathered the witnesses the master's own code reads.
 * The stop sites say where that gathering happens: one `call` site per external call, in call order, and one
 * `segmentClose` site per segment, so a run with `k` calls publishes `2k + 1` sites. The driver resumes each
 * execution at its sites in order, filling one witness per step, and derives each call's callee before its caller
 * resumes (`solidcash/src/per-call/composer/derivation.ts`).
 *
 * No `read` site is published yet. A read's site carries the identity of the record it reads, and the compiler
 * does not hold a record identity at this point: which records a master touches is decided by settlement, not by
 * the entry's source. A stand-in that filled a read with an invented record would be worse than not publishing it,
 * so reads are omitted until the compiler can name the record each one resolves to.
 *
 * The sites are validated against the frozen stop-site schema before they are published, so a table that a driver
 * would refuse never reaches an artifact. Each entry also carries the source-side facts a builder needs to name
 * the callee of each call — the interface and method it targets, the address called and the dispatcher selector —
 * because the frozen `CallStopSite` holds only the call's index.
 */

import { binToHex } from '@bitauth/libauth';
import {
  STOP_SITE_METADATA_VERSION,
  validateStopSiteMetadata,
  type StopSite,
  type StopSiteMetadata,
} from '@solidcash/utils';
import type { MasterCallSite } from './frame-tail.js';

/** One external call as the driver needs to see it: the call's index and what it targets. */
export interface PublishedCallSite {
  readonly callIndex: number;
  /** The interface the call goes through, for diagnostics and callee resolution. */
  readonly interfaceName: string;
  /** The method called, whose entry the callee runs. */
  readonly functionName: string;
  /** The address called, as hex; empty when the caller's own code computes the target, which a driver reads at
   * the call site rather than from this table. */
  readonly target: string;
  /** The callee's four-byte dispatcher selector, as hex. */
  readonly selector: string;
}

/** One entry's stop sites plus the call facts a driver resolves a callee through. */
export interface PublishedEntryStopSites {
  /** The entry's identity, `Contract.entry()`, which a `FrameRequest.functionName` matches. */
  readonly functionName: string;
  /** One record per external call, in call order. */
  readonly calls: readonly PublishedCallSite[];
  /** The sites in the order the driver reaches them, validated before publication. */
  readonly sites: StopSiteMetadata;
}

/** Every entry of one contract, as published on its artifact. */
export interface PublishedPerCallStopSites {
  readonly version: 1;
  readonly entries: readonly PublishedEntryStopSites[];
}

/** The identity a driver's `FrameRequest.functionName` uses for an entry. */
export function entryFunctionName(contractName: string, entryName: string): string {
  return `${contractName}.${entryName}()`;
}

/**
 * The sites of an execution with `calls` external calls: every call in order, then every segment close.
 *
 * `repeats` marks the calls of a body a loop makes: the site is named once while one execution reaches it as often
 * as the loop turns, so the table is a description of the source rather than an enumeration of the witnesses one
 * execution needs.
 *
 * A call's witness is the callee's result, which a driver derives depth-first; the close of a segment is the
 * records that segment computed, which cannot be compared until the calls bounding it have returned. Publishing
 * the calls before the closes is what lets a driver derive the callees first.
 */
export function entryStopSites(
  functionName: string,
  calls: readonly MasterCallSite[],
  pathCount: number = calls.length,
  repeats = false,
): StopSiteMetadata {
  const sites: StopSite[] = [];
  for (let descriptor = 0; descriptor < calls.length; descriptor += 1) {
    const call = calls[descriptor]!;
    // The position the execution reaches this call at, which is the record it binds: two descriptors of
    // mutually exclusive arms name the same record, so the descriptor's place in this list is not the position.
    sites.push({
      kind: 'call',
      site: sites.length,
      callIndex: call.ordinal ?? descriptor,
      descriptor,
      ...(call.conditional === true ? { conditional: true } : {}),
      ...(repeats ? { repeated: true } : {}),
    });
  }
  // A segment follows each call the execution makes, so the closes are the path's, not the descriptor list's.
  for (let segmentIndex = 0; segmentIndex <= pathCount; segmentIndex += 1) {
    sites.push({ kind: 'segmentClose', site: sites.length, segmentIndex });
  }
  const metadata: StopSiteMetadata = {
    version: STOP_SITE_METADATA_VERSION,
    functionName,
    sites,
  };
  validateStopSiteMetadata(metadata);
  return metadata;
}

/**
 * Builds one contract's published table, one entry per name, each validated before it is returned.
 *
 * Each entry publishes the calls its own source makes, so a driver that resumes an entry names the callees that
 * entry's sites bind rather than another entry's. The entries share the call count the head fixes, but not the
 * calls themselves.
 */
export function publishPerCallStopSites(
  contractName: string,
  entries: readonly {
    readonly entryName: string;
    readonly calls: readonly MasterCallSite[];
    readonly pathCount?: number;
    readonly repeats?: boolean;
  }[],
): PublishedPerCallStopSites {
  return {
    version: 1,
    entries: entries.map(({ entryName, calls, pathCount, repeats }) => {
      const functionName = entryFunctionName(contractName, entryName);
      return {
        functionName,
        calls: calls.map((call, callIndex) => ({
          callIndex,
          interfaceName: call.interfaceName ?? '',
          functionName: call.functionName ?? '',
          target: binToHex(call.target),
          selector: binToHex(call.selector),
        })),
        sites: entryStopSites(functionName, calls, pathCount, repeats === true),
      };
    }),
  };
}
