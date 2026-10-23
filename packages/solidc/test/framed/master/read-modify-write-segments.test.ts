import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The segment a framed entry's mapping write lands in, whichever form the source spells it in.
 *
 * A call closes the segment the code before it runs in, so a write is declared in the segment its own source position
 * names: the one the frame opens with when it precedes every call, the one between two calls when it sits there, and
 * the one the last call opens when it follows them. A write that reads the entry it writes (`m[k] = m[k] + x`,
 * `m[k] += x`), a struct field write, and a write a loop repeats are lowered through a cache the body reads once and
 * writes back once. The write-back stays in the segment the source writes the entry in rather than past the call
 * after it, so a callee that reads the entry back through the contract's getter sees the value written before the
 * call, and the published segment is the one code generation declares the write in.
 */

const OTHER = '0x' + '11'.repeat(31) + 'ee';
const PING = 'interface IOther { function ping(); } contract Other { function ping() { require(true); } }';
// A call through the interface member: no message-bus edge, so every form reaches the cache the body itself plans.
const CALL = `IOther(${OTHER}).ping.call();`;
// A call through the interface cast, which the message-bus lowering plans its own cache for first.
const EDGE_CALL = `IOther(${OTHER}).ping();`;

/** A ledger whose `move` entry runs `body`. */
const LEDGER = (body: string): string => `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   struct Row { uint a; uint b; }'
  + '   mapping(address => uint) balances;'
  + '   mapping(address => Row) rows;'
  + '   function move(address to, uint amount) {'
  + body
  + '     require(true);'
  + '   }'
  + ' }';

/** Each write form, with the collection it writes. */
const FORMS: readonly (readonly [label: string, write: string, collection: string])[] = [
  ['a literal', 'balances[to] = 5;', 'balances'],
  ['a local', 'uint base = amount; balances[to] = base + 1;', 'balances'],
  ['a self-referential update', 'balances[to] = balances[to] + amount;', 'balances'],
  ['a compound update', 'balances[to] += amount;', 'balances'],
  ['a struct field', 'rows[to].a = amount;', 'rows'],
  ['a self-referential struct field', 'rows[to].a = rows[to].a + amount;', 'rows'],
];

/** The places a write takes beside the calls, with the segment it lands in there. */
const PLACES: readonly (readonly [label: string, body: (write: string) => string, segment: number])[] = [
  ['before the only call', (write) => `${write} ${CALL}`, 0],
  ['between two calls', (write) => `${CALL} ${write} ${CALL}`, 1],
  ['after the only call', (write) => `${CALL} ${write}`, 1],
];

/** The segment the artifact publishes `collection`'s write of `move` in, and the entries it refuses. */
function published(artifact: Artifact, collection: string): { segment: unknown; refused: readonly string[] } {
  const entry = artifact.composition?.stopSites?.entries
    .find((candidate) => candidate.functionName === 'Ledger.move()');
  return {
    segment: entry?.writeSegments?.find((write) => write.collection === collection)?.segment,
    refused: (artifact.composition?.refusedEntries ?? []).map((refusal) => refusal.reason),
  };
}

const compile = (body: string): Artifact => compileStringMulti(LEDGER(body), {
  composition: 'framed', suppressWarnings: true,
}).Ledger!;

describe('the segment a framed mapping write lands in, for every form the source spells it in', () => {
  for (const [form, write, collection] of FORMS) {
    it(`publishes ${form} in the segment the source makes it in`, () => {
      const segments = PLACES.map(([, body]) => published(compile(body(write)), collection));
      expect(segments).toStrictEqual(PLACES.map(([, , segment]) => ({ segment, refused: [] })));
    });
  }

  it('publishes two updates of one entry in the segment they share', () => {
    expect(published(compile(`balances[to] += 1; balances[to] += amount; ${CALL}`), 'balances'))
      .toStrictEqual({ segment: 0, refused: [] });
    expect(published(compile(`${CALL} balances[to] += 1; balances[to] += amount; ${CALL}`), 'balances'))
      .toStrictEqual({ segment: 1, refused: [] });
  });

  it('publishes an update a loop repeats in the segment the loop runs in', () => {
    const loop = 'for (uint i = 0; i < amount; i = i + 1) { balances[to] = balances[to] + 1; }';
    expect(published(compile(`${loop} ${CALL}`), 'balances')).toStrictEqual({ segment: 0, refused: [] });
    expect(published(compile(`${CALL} ${loop} ${CALL}`), 'balances')).toStrictEqual({ segment: 1, refused: [] });
  });

  it('publishes the segment the source names beside a call the message-bus lowering plans first', () => {
    const loop = 'for (uint i = 0; i < amount; i = i + 1) { balances[to] = balances[to] + 1; }';
    for (const write of ['balances[to] += amount;', loop]) {
      expect(published(compile(`${write} ${EDGE_CALL}`), 'balances')).toStrictEqual({ segment: 0, refused: [] });
      expect(published(compile(`${EDGE_CALL} ${write} ${EDGE_CALL}`), 'balances'))
        .toStrictEqual({ segment: 1, refused: [] });
    }
  });
});
