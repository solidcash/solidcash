import { describe, expect, it } from 'vitest';
import { buildPushdataCommitment, type StateLayout, type StateValue } from '@solidcash/utils';
import { compileString } from '../src/compiler.js';

// A state field with no static bound (`bigint`, unbounded `bytes` inside a struct) reserved 9 bytes, so it packed
// beside other fields and a wide value overflowed the 128-byte commitment at send time. It now packs alone.
const BIGINT_SOURCE = `pragma solidcash ^0.14.0;
contract Wide {
  int public low;
  bigint public big;
  bool public flag;
  function set(bigint next) { this.big = next; require(true); }
}`;

const STRUCT_SOURCE = `pragma solidcash ^0.14.0;
struct Note { int id; bytes body; }
contract Notes {
  int public low;
  Note note;
  function check() { require(this.low >= 0); }
}`;

function nftIndices(layout: StateLayout): Record<string, number> {
  return Object.fromEntries(layout.variables.map((variable) => [variable.name, variable.nftIndex]));
}

// Throws when a commitment exceeds the layout's limit, as the send would.
function widestCommitment(layout: StateLayout, values: Record<string, StateValue>): number {
  return Math.max(...Array.from({ length: layout.dataNftCount },
    (_, index) => buildPushdataCommitment(layout, values, index).length / 2));
}

describe('state layout of a value with no static bound', () => {
  it('gives a bigint a data NFT of its own, so a wide value fits its commitment', () => {
    const layout = compileString(BIGINT_SOURCE).stateLayout!;
    expect(nftIndices(layout)).toMatchObject({ low: 0, big: 1, flag: 2 });
    expect(widestCommitment(layout, { low: 2n ** 200n, big: 2n ** 900n, flag: true })).toBeLessThanOrEqual(128);
  });

  it('gives a struct holding an unbounded bytes field a data NFT of its own', () => {
    const layout = compileString(STRUCT_SOURCE).stateLayout!;
    expect(nftIndices(layout)).toMatchObject({ low: 0, note: 1 });
    expect(widestCommitment(layout, { low: 2n ** 255n - 1n, note: { id: 7n, body: new Uint8Array(100) } }))
      .toBeLessThanOrEqual(128);
  });
});
