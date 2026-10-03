import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { hexOf, seededAddress } from '../../../../solidcash/test/per-call/shapes/harness.js';

/**
 * What a per-call artifact publishes for a call an earlier `return` can skip.
 *
 * The body binds its call records in the order it makes them, so a run that returns before a call makes no record
 * for it. The call's stop site is therefore conditional, and its routing carries the condition it runs under - no
 * earlier return taken, then its own predicates - so a builder states the call only on a run that makes it. A body
 * whose calls no return can skip publishes what it did before.
 */

const CALLEE = `0x${hexOf(seededAddress('early return callee'))}`;
const HEAD = 'pragma solidcash ^0.13.0; interface IState { function add(int x); }';
const call = (argument: number): string => ` IState(${CALLEE}).add(${argument});`;

const RETURNS = `${HEAD} contract Caller {`
  + `   modifier tail() { _;${call(2)} }`
  + `   function early(bool c) { if (c) { return; }${call(1)} require(true); }`
  + `   function guarded(bool c, bool d) { if (c) { return; } if (d) {${call(1)} } require(true); }`
  + `   function nested(bool c, bool d) { if (c) { if (d) { return; }${call(1)} return; }${call(2)} require(true); }`
  + `   function arms(bool c, bool d) { if (c) { return; } else { if (d) { return; } }${call(1)} require(true); }`
  + `   function split(bool c) { if (c) {${call(1)} return; }${call(2)} require(true); }`
  + `   function looped(bool c, int n) { for (int i = 0; i < n; i = i + 1) { if (c) { return; }${call(1)} }`
  + '     require(true); }'
  + `   function moded(bool c) tail() { if (c) { return; }${call(1)} require(true); }`
  + ' }';

const NO_RETURN = `${HEAD} contract Caller {`
  + `   function guardedOnly(bool d) { if (d) {${call(1)} }${call(2)} require(true); }`
  + '   function other(bool c) { if (c) { return; } require(true); }'
  + ' }';

const param = (paramIndex: number): ExternalCallExpression => ({ kind: 'source', source: { kind: 'forward', paramIndex } });
const not = (expression: ExternalCallExpression): ExternalCallExpression => ({ kind: 'unary', operator: '!', expression });
const and = (left: ExternalCallExpression, right: ExternalCallExpression): ExternalCallExpression =>
  ({ kind: 'binary', operator: '&&', left, right });

const WITH_RETURNS = compileStringMulti(RETURNS, { composition: 'per-call' }).Caller!;
const WITHOUT_RETURNS = compileStringMulti(NO_RETURN, { composition: 'per-call' }).Caller!;

/** The call sites one entry publishes, and the condition its routing carries for each call. */
function published(artifact: Artifact, entry: string): { sites: unknown[]; conditions: unknown[] } {
  const table = artifact.composition!.stopSites!.entries
    .find((candidate) => candidate.functionName === `Caller.${entry}()`)!;
  const rows = (artifact.abi.find((candidate) => candidate.name === entry) as {
    externalCalls?: { condition?: ExternalCallExpression }[];
  }).externalCalls ?? [];
  return {
    sites: table.sites.sites.filter((site) => site.kind === 'call'),
    conditions: rows.map((row) => row.condition),
  };
}

const site = (callIndex: number, descriptor: number, marks: Record<string, true> = {}): unknown =>
  ({ kind: 'call', site: descriptor, callIndex, descriptor, ...marks });

describe('a call an earlier return can skip', () => {
  it('is conditional on no earlier return being taken, beside its own predicates', () => {
    expect(published(WITH_RETURNS, 'early')).toStrictEqual({
      sites: [site(0, 0, { conditional: true })], conditions: [not(param(0))],
    });
    expect(published(WITH_RETURNS, 'guarded').conditions).toStrictEqual([and(not(param(0)), param(1))]);
    // A return nested in an arm skips the call after it in that arm, and the arm that returns skips the call after
    // the branch.
    expect(published(WITH_RETURNS, 'nested')).toStrictEqual({
      sites: [site(0, 0, { conditional: true }), site(1, 1, { conditional: true })],
      conditions: [and(not(param(1)), param(0)), not(param(0))],
    });
    expect(published(WITH_RETURNS, 'arms').conditions).toStrictEqual([and(not(param(0)), not(param(1)))]);
    // The call in the returning arm and the call after the branch are the same record of either run.
    expect(published(WITH_RETURNS, 'split')).toStrictEqual({
      sites: [site(0, 0, { conditional: true }), site(0, 1, { conditional: true })],
      conditions: [param(0), not(param(0))],
    });
    // A return in a loop body skips the call after it in the same turn.
    expect(published(WITH_RETURNS, 'looped')).toStrictEqual({
      sites: [site(0, 0, { conditional: true, repeated: true })], conditions: [not(param(0))],
    });
    // The modifier's call after `_` runs after the body, so the body's return skips it too.
    expect(published(WITH_RETURNS, 'moded').conditions).toStrictEqual([not(param(0)), not(param(0))]);
  });

  it('leaves a body whose calls no return can skip as it was', () => {
    expect(published(WITHOUT_RETURNS, 'guardedOnly')).toStrictEqual({
      sites: [site(0, 0, { conditional: true }), site(1, 1)], conditions: [param(0), undefined],
    });
  });
});
