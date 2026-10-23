import { describe, expect, it } from 'vitest';
import { isServed, refusalOf as publishedRefusalOf } from './refused-entry.js';
import { compileStringMulti } from '../../../src/compiler.js';
import { hexOf, seededAddress } from '../../../../solidcash/test/framed/shapes/harness.js';

/**
 * Why a call the head cannot bind is refused, and what the refusal says.
 *
 * A framed body binds one record per call where the source makes it, so the head needs the call set fixed by the
 * source. A call whose occurrence the source does not fix — one in a loop, or in a branch whose arms make
 * different numbers of calls — is served by the run-time position mode, which carries how many calls the execution
 * has made. The shapes that stay refused are the ones the walk cannot count through (a switch, or a branch or loop
 * inside an expression) and a call whose callee or selector is resolved at run time; the two name themselves in
 * the message a reader sees. The data-NFT inputs the direct convention co-spends for a callee are not part of the
 * shape a site binds — a site reads the callee's record out of the witness block, and the callee's own records are
 * settled by the segments — so they do not decide admission.
 */

const CALLEE = hexOf(seededAddress('call shape callee'));

const HEAD = 'pragma solidcash ^0.14.0;';

const INTERFACES = ' interface IState { function add(int x); }'
  + ' interface IPeek { function peek() returns (int); }'
  + ' interface ISum { function sum(int x) returns (int); }';

/** The shape the marketplace's claim entry has: a helper whose arms each call out, reached from the entry. */
const HELPER_WITH_ARMS = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function pick(bool take, int x) internal returns (int) {'
  + '     int chosen;'
  + `     if (take) { chosen = ISum(0x${CALLEE}).sum(x); }`
  + `     else { chosen = ISum(0x${CALLEE}).sum(x + 1); }`
  + '     return chosen;'
  + '   }'
  + '   function go(bool take, int x) { require(pick(take, x) > 0); require(true); }'
  + ' }';

/** A helper that calls out only in one arm, reached from an entry: the shape a parameter-checking helper has. */
const HELPER_WITH_ONE_ARM = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function pick(bool take, int x) internal returns (int) {'
  + '     int chosen = 0;'
  + `     if (take) { chosen = ISum(0x${CALLEE}).sum(x); }`
  + '     return chosen;'
  + '   }'
  + '   function go(bool take, int x) { require(pick(take, x) >= 0); require(true); }'
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

/** A caller whose call runs only in one branch: the body carries how many calls it made, zero or one. */
const CONDITIONAL_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + `   function go(bool take) { if (take) { IState(0x${CALLEE}).add(1); } require(true); }`
  + ' }';

/** A caller whose call sits in a switch arm, a statement the call walk cannot count through. */
const SWITCH_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function go(uint x) {'
  + `     switch (x) { case 0: IState(0x${CALLEE}).add(1); break; default: require(true); }`
  + '     require(true);'
  + '   }'
  + ' }';

/** A caller whose raw low-level call runs only in one branch, over a result the framed body does not settle. */
const RAW_CONDITIONAL_CALL = HEAD + INTERFACES
  + ' contract Caller {'
  + '   function go(bool take, address target, bytes data) {'
  + '     if (take) { (bool ok,) = address(target).call(data); require(ok); }'
  + '     require(true);'
  + '   }'
  + ' }';

/** A proxy whose fallback always forwards: a served shape, the control for the conditional one below. */
const FORWARDING_PROXY = HEAD
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

/** A proxy whose forwarding delegatecall runs only in one branch, which the run-time mode does not carry. */
const CONDITIONAL_FORWARDING_PROXY = HEAD
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external {'
  + '     if (input.length > 0) { this.implementation.delegatecall(input); }'
  + '     require(true);'
  + '   }'
  + ' }';

/** The refusal the shipped compile raises for a source, or a failure when it accepts it. */
/** The refusal the compile publishes for the one body these sources have, as the old throw used to carry it. */
const refusalOf = (source: string): { code?: string; message: string } => publishedRefusalOf(source);

// A branch whose arms each make one call is admitted and accepted by the machine in `branched-call-entry.test.ts`.

describe('a helper whose arms each call out, reached from an entry', () => {
  it('is admitted, which is the shape a claim entry has', () => {
    // The helper is inlined into the entry, so its arms are the entry's: every path makes one call, the record is
    // the first on either arm, and the segment the code after the branch reads is the same one.
    const artifacts = compileStringMulti(HELPER_WITH_ARMS, { composition: 'framed' });
    expect(artifacts.Caller?.composition?.convention).toBe('framed');
    expect(artifacts.Caller?.abi.some((entry) => entry.name === 'go')).toBe(true);
  });

  it('is admitted when only one of its arms calls out, the shape a check helper has', () => {
    // The helper is inlined, so the entry makes zero or one call: the body carries the count, as the direct
    // conditional case does. The helper boundary does not decide admission.
    expect(isServed(HELPER_WITH_ONE_ARM)).toBe(true);
  });
});

describe('a call whose occurrence the source does not fix', () => {
  it('is admitted from a branch, where the body counts the calls the arm it ran made', () => {
    // The body makes zero or one call, a number its source does not fix, so it carries how many it has made and
    // binds the record that number names. The machine's own cases for the shape live in
    // `master/conditional-call-entry.test.ts`.
    const artifacts = compileStringMulti(CONDITIONAL_CALL, { composition: 'framed' });
    expect(artifacts.Caller?.composition?.convention).toBe('framed');
    const sites = artifacts.Caller!.composition!.stopSites!.entries[0]!.sites.sites;
    // The site is marked conditional — the arm may skip it — but not repeated: nothing turns.
    expect(sites[0]).toStrictEqual({
      kind: 'call', site: 0, callIndex: 0, descriptor: 0, conditional: true,
    });
  });

  it('is refused from a switch, whose arms the call walk cannot count through', () => {
    const refusal = refusalOf(SWITCH_CALL);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('is in a body that switches');
    expect(refusal.message).not.toContain('resolves its callee');
  });

  it('is refused for a raw low-level call, whose result the framed body does not settle', () => {
    // The branch no longer decides admission, so the raw call's own reason is what a reader sees: its returning
    // form takes the direct path's return-event machinery, which a framed body does not emit.
    const refusal = refusalOf(RAW_CONDITIONAL_CALL);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('return-event or value-transfer machinery');
    expect(refusal.message).not.toContain('runs conditionally');
  });

  it('is refused for a conditional forwarding delegatecall, which the run-time position mode does not carry', () => {
    // A proxy whose fallback always forwards is served; the same fallback behind an arm is refused by name, since
    // the forwarded site is emitted at a position the descriptor list fixes.
    expect(isServed(FORWARDING_PROXY)).toBe(true);
    const refusal = refusalOf(CONDITIONAL_FORWARDING_PROXY);
    expect(refusal.code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('forwards its own call data conditionally');
  });

  it('is admitted inside a loop, where the body counts the calls its own iterations made', () => {
    // The walk stops at the loop, so neither the count nor the occurrence is a single value: the body binds the
    // record the number of calls it has made names and pins the count it ended at, which is what makes the shape
    // expressible. The machine's own cases for it live in `master/looped-call-entry.test.ts`.
    const artifacts = compileStringMulti(BRANCHED_IN_LOOP_CALL, { composition: 'framed' });
    expect(artifacts.Caller?.composition?.convention).toBe('framed');
    const sites = artifacts.Caller!.composition!.stopSites!.entries[0]!.sites.sites;
    // The site is marked both ways: the arm can skip an iteration, and the loop decides how many iterations there
    // are, so neither the occurrence nor the number of records is a fact the table can enumerate.
    expect(sites[0]).toStrictEqual({
      kind: 'call', site: 0, callIndex: 0, descriptor: 0, conditional: true, repeated: true,
    });
  });
});
