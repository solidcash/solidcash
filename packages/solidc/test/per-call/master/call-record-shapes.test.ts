import { describe, expect, it } from 'vitest';
import type { StopSite } from '@solidcash/utils';
import { refusalOf as publishedRefusalOf } from './refused-entry.js';
import { compileStringMulti } from '../../../src/compiler.js';
import { hexOf, seededAddress } from '../../../../solidcash/test/per-call/shapes/harness.js';

/**
 * Why a call the head cannot bind is refused, and what the refusal says.
 *
 * A per-call body binds one record per call where the source makes it, so the head needs the call set fixed by the
 * source. Three unrelated facts used to share one refusal: a call whose *occurrence* the source does not fix (a
 * branch, a loop, or a repeated batch), a call whose *callee or selector* is resolved at run time, and the data-NFT
 * inputs the direct convention co-spends for a callee. The third is not part of the shape a site binds — a site
 * reads the callee's record out of the witness block, and the callee's own records are settled by the segments — so
 * it no longer decides admission, and the two that remain name themselves in the message a reader sees.
 */

const CALLEE = hexOf(seededAddress('call shape callee'));

const HEAD = 'pragma solidcash ^0.13.0;';

const INTERFACES = ' interface IState { function add(int x); }'
  + ' interface IPeek { function peek() returns (int); }'
  + ' interface ISum { function sum(int x) returns (int); }';

/** The shape the marketplace's claim entry has: a helper whose arms each call out, reached from the entry. */
const HELPER_WITH_ARMS = HEAD + INTERFACES
  + ' contract Caller {'
  + `   function pick(bool take, int x) internal returns (int) {`
  + '     int chosen;'
  + `     if (take) { chosen = ISum(0x${CALLEE}).sum(x); }`
  + `     else { chosen = ISum(0x${CALLEE}).sum(x + 1); }`
  + '     return chosen;'
  + '   }'
  + '   function go(bool take, int x) { require(pick(take, x) > 0); require(true); }'
  + ' }';

/** A caller whose arms each make one call, so every path makes the same number of calls. */
const BALANCED_ARMS = HEAD + INTERFACES
  + ' contract Caller {'
  + `   function go(bool take) { if (take) { IState(0x${CALLEE}).add(1); }`
  + `     else { IPeek(0x${CALLEE}).peek(); } require(true); }`
  + ' }';

/**
 * A caller whose call a branch inside a loop can skip.
 *
 * The body makes a run-time number of calls and the arm decides which iterations make one, so the count and the
 * occurrence are both values the execution produces. The body carries the count it made, so the shape is admitted:
 * `master/looped-call-entry.test.ts` runs the same structure through the machine, accepting the two calls three
 * iterations leave when the first is skipped and refusing a tail that declares three.
 */
const BRANCHED_IN_LOOP_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function go(bool take, int n) {'
  + `     for (int i = 0; i < n; i = i + 1) { if (take) { IState(0x${CALLEE}).add(1); } require(true); }`
  + '   }'
  + ' }';

/** A caller whose call runs only in one branch, which is a call set the source does not fix. */
const CONDITIONAL_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + `   function go(bool take) { if (take) { IState(0x${CALLEE}).add(1); } require(true); }`
  + ' }';

/** A caller whose one call is unconditional, so the set the head walks is fixed by the source. */
const PLAIN_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + `   function go() { IState(0x${CALLEE}).add(1); require(true); }`
  + ' }';

/** The refusal the shipped compile raises for a source, or a failure when it accepts it. */
/** The refusal the compile publishes for the one body these sources have, as the old throw used to carry it. */
const refusalOf = (source: string): { code?: string; message: string } => publishedRefusalOf(source);

describe('a call whose occurrence the source fixes', () => {
  it('is admitted, one record per call, which is the control beside the refusal below', () => {
    // The same call, made unconditionally, compiles: what the negative case refuses is the branch, not the call.
    const artifacts = compileStringMulti(PLAIN_CALL, { composition: 'per-call' });
    expect(artifacts.Caller?.composition?.convention).toBe('per-call');
    expect(artifacts.Caller?.abi.some((entry) => entry.name === 'go')).toBe(true);
  });
});

describe('a branch whose arms each make one call', () => {
  it('is admitted, because every path makes the same number of calls', () => {
    // The execution reaches the same position on either arm, so the record a body binds, the segment the code
    // after the branch reads, and the count it pins are facts of every path — which is what the head needs.
    const artifacts = compileStringMulti(BALANCED_ARMS, { composition: 'per-call' });
    expect(artifacts.Caller?.composition?.convention).toBe('per-call');
    expect(artifacts.Caller?.abi.some((entry) => entry.name === 'go')).toBe(true);
  });
});

describe('a helper whose arms each call out, reached from an entry', () => {
  it('is admitted, which is the shape a claim entry has', () => {
    // The helper is inlined into the entry, so its arms are the entry's: every path makes one call, the record is
    // the first on either arm, and the segment the code after the branch reads is the same one.
    const artifacts = compileStringMulti(HELPER_WITH_ARMS, { composition: 'per-call' });
    expect(artifacts.Caller?.composition?.convention).toBe('per-call');
    expect(artifacts.Caller?.abi.some((entry) => entry.name === 'go')).toBe(true);
  });
});

describe('a call whose occurrence the source does not fix', () => {
  it('is refused, and the message names the conditional set rather than a run-time callee', () => {
    const refusal = refusalOf(CONDITIONAL_CALL);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('runs conditionally');
    expect(refusal.message).toContain('do not make the same number of calls');
    expect(refusal.message).not.toContain('resolves its callee');
  });

  it('is admitted inside a loop, where the body counts the calls its own iterations made', () => {
    // The walk stops at the loop, so neither the count nor the occurrence is a single value: the body binds the
    // record the number of calls it has made names and pins the count it ended at, which is what makes the shape
    // expressible. The machine's own cases for it live in `master/looped-call-entry.test.ts`.
    const artifacts = compileStringMulti(BRANCHED_IN_LOOP_CALL, { composition: 'per-call' });
    expect(artifacts.Caller?.composition?.convention).toBe('per-call');
    const sites = (artifacts.Caller?.composition?.stopSites as { entries: { sites: { sites: StopSite[] } }[] })
      .entries[0]!.sites.sites;
    // The site is marked both ways: the arm can skip an iteration, and the loop decides how many iterations there
    // are, so neither the occurrence nor the number of records is a fact the table can enumerate.
    expect(sites[0]).toStrictEqual({
      kind: 'call', site: 0, callIndex: 0, descriptor: 0, conditional: true, repeated: true,
    });
  });
});
