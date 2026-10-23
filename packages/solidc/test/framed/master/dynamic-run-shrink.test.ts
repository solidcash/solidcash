import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';
import {
  deployChunkRunContract, distinctBytes, evaluateChunkRuns, lengthHeader, type ChunkRunMutation,
} from './chunk-run-input.js';

/**
 * A framed master whose entry writes a dynamic value narrower than the run it spends, settled on the BCH-2026
 * machine.
 *
 * The segment declares the run at the wider of its two widths: each chunk the written value holds is rewritten in
 * place, and each chunk past it is consumed with no successor, spent from the value's own chunk address while its
 * index carries a plain output. The run census binds both widths: the spent one to the length the data record starts
 * from, the written one to the value the body computes. A value shortened from three chunks to two and from two to
 * one is accepted, and each refusal moves one fact of an accepted transaction: the record declares another width,
 * the run is declared at the written width alone or carries the dropped chunk on, or the dropped chunk's index
 * carries it back while its declaration consumes it.
 *
 * The transactions are laid out by `chunk-run-input.ts`, which declares each position the way the SDK's chunk plan
 * does.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Note {'
  + '   string public text;'
  + '   function set(string value) { this.text = value; }'
  + ' }';

const note = deployChunkRunContract(compileString(SOURCE, { composition: 'framed' }), 'dynamic run shrink');

/** 300 bytes take three chunks, 200 two and 100 one. */
const THREE = distinctBytes(300, 0x15);
const TWO = distinctBytes(200, 0x27);
const ONE = distinctBytes(100, 0x39);

/** One shortening write: the value the deployment holds and the narrower one the entry writes. */
interface Shape {
  readonly label: string;
  readonly spent: Uint8Array;
  readonly written: Uint8Array;
}

const SHAPES: readonly Shape[] = [
  { label: 'three chunks to two', spent: THREE, written: TWO },
  { label: 'two chunks to one', spent: TWO, written: ONE },
];

describe.each(SHAPES)('a framed master that shortens a string value from $label', (shape) => {
  const write = (mutation: ChunkRunMutation = {}): boolean => evaluateChunkRuns(note, {
    args: [shape.written],
    runs: [{ variable: 'text', type: 'string', spent: shape.spent, written: shape.written }],
  }, mutation).accepted;

  it('accepts the run declared at its spent width, the dropped chunks consumed with no successor', () => {
    expect(write()).toBe(true);
  });

  it('refuses a record that declares the written value at another width', () => {
    expect(write({ writtenHeader: lengthHeader(note, { text: shape.spent.length }) })).toBe(false);
    expect(write({ writtenHeader: lengthHeader(note, { text: 1 }) })).toBe(false);
  });

  it('refuses the run declared at the written width alone, the dropped chunk left unspent', () => {
    expect(write({ leaveRemoved: true })).toBe(false);
  });

  it('refuses the dropped chunk carried on as a written one', () => {
    expect(write({ keepRemoved: true })).toBe(false);
  });

  it('refuses the dropped chunk recreated at its index while its declaration consumes it', () => {
    expect(write({ recreateRemoved: true })).toBe(false);
  });
});
