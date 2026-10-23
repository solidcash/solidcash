import { describe, expect, it } from 'vitest';
import type { PublishedLoopEffectRun, PublishedLoopEffects } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * The effects a framed body repeats once per turn of a loop, as the compile publishes them.
 *
 * A body that emits, sends or hashes inside a loop binds each effect where it makes it and pins how many it made, so
 * the compile publishes the order a builder lays the outputs and side-cars in: runs the body makes once, and runs a
 * loop makes once per turn, with the loop's recurrence. A body whose order no builder could reconstruct is refused by
 * name: an effect on a branch beside a looped one, one in a nested loop, and one in a loop whose bound is no counted
 * recurrence. The settlements are machine cases in `solidcash/test/framed/call/loop-turn-effects.test.ts`.
 */

const compile = (body: string): ReturnType<typeof compileStringMulti> => compileStringMulti(
  'pragma solidcash ^0.14.0;'
  + ' contract Looper {'
  + '   int public count;'
  + '   bytes32 public digest;'
  + '   event Seen(int x);'
  + '   receive() external payable { require(true); }'
  + `   ${body}`
  + ' }',
  { composition: 'framed' },
);

/** The runs one entry publishes, as `[ids, counter]` per run, keyed by kind. */
function runsOf(body: string, entry: string): Record<string, unknown> {
  const artifact = compile(body).Looper!;
  const row = artifact.composition?.stopSites?.entries.find((candidate) => candidate.functionName === `Looper.${entry}()`);
  const effects: PublishedLoopEffects = row?.loopEffects ?? {};
  const runs = (kind: keyof PublishedLoopEffects): unknown[] =>
    (effects[kind] ?? []).map((run: PublishedLoopEffectRun) => [run.ids, run.iterationDomain?.counterName ?? null]);
  return Object.fromEntries((Object.keys(effects) as (keyof PublishedLoopEffects)[]).map((kind) => [kind, runs(kind)]));
}

/** The reason the compile publishes for refusing `entry`, or '' when it serves it. */
function refusalOf(body: string, entry: string): string {
  return publishedRefusals(compile(body)).find((refused) => refused.functionName === `Looper.${entry}()`)?.reason ?? '';
}

describe('the runs a body that repeats effects in a loop publishes', () => {
  it('publishes the events a loop emits beside the ones the body emits once, in execution order', () => {
    expect(runsOf('function f(int n) {'
      + '   emit Seen(-1);'
      + '   for (int i = 0; i < n; i = i + 1) { emit Seen(i); emit Seen(i * 2); }'
      + '   emit Seen(-2);'
      + ' }', 'f')).toStrictEqual({ events: [[[0], null], [[1, 2], 'i'], [[3], null]] });
  });

  it('publishes the sends a loop makes', () => {
    expect(runsOf('function pay(address[] to, int each) {'
      + '   for (int i = 0; i < to.length; i = i + 1) { this.transfer(to[i], each); }'
      + '   this.count = this.count + 1;'
      + ' }', 'pay')).toStrictEqual({ sends: [[[0], 'i']] });
  });

  it('publishes the hashes a loop makes beside the one the body makes first', () => {
    expect(runsOf('function walk(bytes32 leaf, bytes32[] path) {'
      + '   bytes32 node = keccak256(leaf);'
      + '   for (int i = 0; i < path.length; i = i + 1) { node = keccak256(bytes.concat(node, path[i])); }'
      + '   this.digest = node;'
      + ' }', 'walk')).toStrictEqual({ hashes: [[[0], null], [[1], 'i']] });
  });

  it('publishes nothing for a body whose effects no loop repeats', () => {
    expect(runsOf('function f(int x) { emit Seen(x); this.count = x; }', 'f')).toStrictEqual({});
  });
});

describe('a body whose looped effects no builder could lay', () => {
  it('is refused for an event on a branch beside a looped one', () => {
    expect(refusalOf('function f(int n) {'
      + '   for (int i = 0; i < n; i = i + 1) { if (i > 1) { emit Seen(i); } }'
      + ' }', 'f')).toBe('an event emitted on a branch beside one in a loop, so a builder cannot count the event outputs '
      + 'the body binds in turn');
  });

  it('is refused for a send in a nested loop', () => {
    expect(refusalOf('function pay(address[] to, int n) {'
      + '   for (int i = 0; i < n; i = i + 1) {'
      + '     for (int j = 0; j < to.length; j = j + 1) { this.transfer(to[j], 1000); }'
      + '   }'
      + '   this.count = this.count + 1;'
      + ' }', 'pay')).toBe('a value send in a nested loop, a do-while loop, a collection iteration or a loop condition, '
      + 'so a builder cannot count the send outputs the body binds in turn');
  });

  it('is refused for a hash in a loop whose bound is no counted recurrence', () => {
    expect(refusalOf('function walk(bytes32 seed, int n) {'
      + '   bytes32 node = seed;'
      + '   int left = n;'
      + '   while (left > 0) { node = keccak256(node); left = left / 2; }'
      + '   this.digest = node;'
      + ' }', 'walk')).toBe('a keccak256 call in a loop whose counter or bound is not a recurrence the entry\'s own facts '
      + 'fix, so a builder cannot count the side-cars the body binds in turn');
  });

  it('is refused for a balance read beside a loop that sends', () => {
    expect(refusalOf('function pay(address[] to) {'
      + '   for (int i = 0; i < to.length; i = i + 1) { this.transfer(to[i], this.balance / 2); }'
      + '   this.count = this.count + 1;'
      + ' }', 'pay')).toContain('reads its contract\'s balance and sends from a loop');
  });

  it('refuses the whole contract for a constructor that emits from a loop, which its genesis does not count', () => {
    expect(() => compileStringMulti('pragma solidcash ^0.14.0;'
      + ' contract Looper {'
      + '   int public count;'
      + '   event Seen(int x);'
      + '   constructor(int n) { for (int i = 0; i < n; i = i + 1) { emit Seen(i); } }'
      + '   function f() { this.count = 1; }'
      + ' }', { composition: 'framed' })).toThrow('the constructor emits an event from a loop, whose turns its genesis '
      + 'does not count');
  });
});
