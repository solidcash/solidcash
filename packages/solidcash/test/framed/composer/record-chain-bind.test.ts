import { describe, expect, it } from 'vitest';
import { INDEX_NONE, type RecordEntry } from '@solidcash/utils';
import { bindRecordChainStarts } from '../../../src/framed/composer/draft.js';

/**
 * Binding a record's chain to the input the transaction spends.
 *
 * A block can carry a record's first declaration from a read that differs from the input's commitment; the
 * validator compares the two at the first declaration and refuses the transaction with an opcode failure that names
 * neither. `bindRecordChainStarts` makes the input the authority — only at the chain's first view, because later
 * declarations carry on from the view before them.
 */

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const spent = bytes(1, 2, 3, 4, 5);

/** What a record entry looks like when it declares an input, with the views the tests compare. */
const entry = (input: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry => ({
  in: input, out: input, viewIn, viewOut,
});

describe('bindRecordChainStarts', () => {
  it('begins a record chain at the commitment its input carries', () => {
    const first = entry(3, bytes(9, 9), spent);
    const segments = [[first]];

    bindRecordChainStarts(segments, (index) => (index === 3 ? { id: 'record-3', commitment: spent } : undefined));

    expect(segments[0]![0]!.viewIn).toEqual(spent);
    // The declaration's end view belongs to the plan and is left as it was.
    expect(segments[0]![0]!.viewOut).toEqual(spent);
  });

  it('leaves every later declaration of the same record alone', () => {
    const first = entry(3, bytes(9, 9), spent);
    const second = entry(3, spent, bytes(7, 7));
    const segments = [[first], [second]];

    bindRecordChainStarts(segments, (index) => (index === 3 ? { id: 'record-3', commitment: spent } : undefined));

    expect(segments[0]![0]!.viewIn).toEqual(spent);
    // The later declaration starts at the view the first one left, which is not the input's commitment here.
    expect(segments[1]![0]).toBe(second);
  });

  it('does not touch a created record or an input that is not a record', () => {
    const created = entry(INDEX_NONE, new Uint8Array(0), spent);
    const caller = entry(0, bytes(8, 8), spent);
    const segments = [[created, caller]];

    bindRecordChainStarts(segments, () => undefined);

    expect(segments[0]![0]).toBe(created);
    expect(segments[0]![1]).toBe(caller);
  });

  it('keeps a first declaration that already matches', () => {
    const first = entry(3, spent, spent);
    const segments = [[first]];

    bindRecordChainStarts(segments, (index) => (index === 3 ? { id: 'record-3', commitment: spent } : undefined));

    expect(segments[0]![0]).toBe(first);
  });
});
