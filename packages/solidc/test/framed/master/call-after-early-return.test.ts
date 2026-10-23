import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { hexOf, seededAddress } from '../../../../solidcash/test/framed/shapes/harness.js';

/**
 * What a framed artifact publishes for a call an earlier `return` can skip.
 *
 * The body binds its call records in the order it makes them, so a run that returns before a call makes no record
 * for it. The call's stop site is therefore conditional, and its routing carries the condition it runs under - no
 * earlier return taken, then its own predicates - so a builder states the call only on a run that makes it. A body
 * whose calls no return can skip publishes what it did before.
 *
 * A return the early-return nesting cannot end a path at is lowered to a flag of the compiler's that gates what
 * follows it, and a modifier-wrapped body's return to one that ends the body alone. A call such a gate holds is
 * published under the predicates the gate stands for - no return before it taken - rather than the flag.
 */

const CALLEE = `0x${hexOf(seededAddress('early return callee'))}`;
const HEAD = 'pragma solidcash ^0.14.0; interface IState { function add(int x); }';
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

// Returns under a further condition: the nesting cannot end their paths, so each is lowered to a flag.
const CONFINED = `${HEAD} contract Caller {`
  + `   function deep(bool c, bool d) { if (c) { if (d) { return; } }${call(1)} require(true); }`
  + `   function inside(bool c, bool d) { if (c) {${call(1)} if (d) { return; }${call(2)} }${call(3)}`
  + '     require(true); }'
  + `   function twice(bool c, bool d, bool e) { if (c) { if (d) { return; } if (e) { return; } }${call(1)}`
  + '     require(true); }'
  + ' }';

const FALLBACK = `${HEAD} contract Caller { bool stop;`
  + `   fallback() external { if (stop) { return; }${call(1)} require(true); }`
  + ' }';

const NO_RETURN = `${HEAD} contract Caller {`
  + `   function guardedOnly(bool d) { if (d) {${call(1)} }${call(2)} require(true); }`
  + '   function other(bool c) { if (c) { return; } require(true); }'
  + ' }';

const param = (paramIndex: number): ExternalCallExpression => ({ kind: 'source', source: { kind: 'forward', paramIndex } });
const not = (expression: ExternalCallExpression): ExternalCallExpression => ({ kind: 'unary', operator: '!', expression });
const and = (left: ExternalCallExpression, right: ExternalCallExpression): ExternalCallExpression =>
  ({ kind: 'binary', operator: '&&', left, right });

const WITH_RETURNS = compileStringMulti(RETURNS, { composition: 'framed' }).Caller!;
const WITH_CONFINED = compileStringMulti(CONFINED, { composition: 'framed' }).Caller!;
const WITH_FALLBACK = compileStringMulti(FALLBACK, { composition: 'framed' }).Caller!;
const WITHOUT_RETURNS = compileStringMulti(NO_RETURN, { composition: 'framed' }).Caller!;

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
    // The body's return leaves the body alone, so the modifier's call after `_` is made on either path.
    expect(published(WITH_RETURNS, 'moded')).toStrictEqual({
      sites: [site(0, 0, { conditional: true }), site(1, 1)], conditions: [not(param(0)), undefined],
    });
  });

  it('is conditional on the predicates of a return lowered to a flag, not on the flag', () => {
    expect(published(WITH_CONFINED, 'deep')).toStrictEqual({
      sites: [site(0, 0, { conditional: true })], conditions: [not(and(param(0), param(1)))],
    });
    // A call before the return keeps its own predicate; one after it in the arm, and one after the arm, are gated.
    expect(published(WITH_CONFINED, 'inside').conditions).toStrictEqual([
      param(0), and(param(0), not(param(1))), not(and(param(0), param(1))),
    ]);
    // The second return is itself gated on the first not being taken.
    expect(published(WITH_CONFINED, 'twice').conditions).toStrictEqual([
      and(not(and(param(0), param(1))), not(and(and(param(0), not(param(1))), param(2)))),
    ]);
  });

  it('is conditional on the guard of a fallback\'s early return', () => {
    expect(published(WITH_FALLBACK, '__fallback')).toStrictEqual({
      sites: [site(0, 0, { conditional: true })], conditions: [not({ kind: 'state', name: 'stop' })],
    });
  });

  it('leaves a body whose calls no return can skip as it was', () => {
    expect(published(WITHOUT_RETURNS, 'guardedOnly')).toStrictEqual({
      sites: [site(0, 0, { conditional: true }), site(1, 1)], conditions: [param(0), undefined],
    });
  });
});
