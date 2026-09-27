import { describe, expect, it } from 'vitest';
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

const INTERFACES = ' interface IState { function add(int x); }';

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
function refusalOf(source: string): { code?: string; message: string } {
  try {
    compileStringMulti(source, { composition: 'per-call' });
  } catch (error) {
    return error as { code?: string; message: string };
  }
  throw new Error('the shipped per-call compiler accepted the source, so there is no refusal to record');
}

describe('a call whose occurrence the source fixes', () => {
  it('is admitted, one record per call, which is the control beside the refusal below', () => {
    // The same call, made unconditionally, compiles: what the negative case refuses is the branch, not the call.
    const artifacts = compileStringMulti(PLAIN_CALL, { composition: 'per-call' });
    expect(artifacts.Caller?.composition?.convention).toBe('per-call');
    expect(artifacts.Caller?.abi.some((entry) => entry.name === 'go')).toBe(true);
  });
});

describe('a call whose occurrence the source does not fix', () => {
  it('is refused, and the message names the conditional set rather than a run-time callee', () => {
    const refusal = refusalOf(CONDITIONAL_CALL);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toContain('runs conditionally or repeatedly');
    expect(refusal.message).not.toContain('resolves its callee');
  });
});
