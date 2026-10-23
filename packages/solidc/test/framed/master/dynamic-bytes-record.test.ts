import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment } from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import {
  chunkLock, deployChunkRunContract, distinctBytes, distinctLock, evaluateChunkRuns, lengthHeader,
  type ChunkRunMutation,
} from './chunk-run-input.js';

/**
 * A framed master whose state is `bytes`, settled on the BCH-2026 machine.
 *
 * A `bytes` state variable is held like a `string`: the data NFT carries the value's length and the bytes live in a
 * run of 120-byte chunk records at the value's own collection address. A write consumes every chunk the spent value
 * holds and creates every chunk the written value holds: a chunk both hold is rewritten in place, one only the
 * written value holds is created with no input, and one only the spent value holds is spent with no record written
 * back. The frame holds its own segment's run to exactly that, record by record, and declares nothing past it, so a
 * stale chunk or an extra one is never left at the address where a later read would take it for the value's own.
 *
 * The transactions are laid out by `chunk-run-input.ts`, which declares each position the way the SDK's chunk plan
 * does. Each refusal moves one fact of an accepted transaction.
 */

const APPEND_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Blob {'
  + '   bytes public data;'
  + '   function append() { this.data = bytes.concat(this.data, 0x21); }'
  + ' }';

const SET_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Blob {'
  + '   bytes public data;'
  + '   function set(bytes value) { this.data = value; }'
  + ' }';

/** Two values in one record: a read of one must be served by its own chunks, kept where they are. */
const READ_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Pair {'
  + '   bytes public data;'
  + '   bytes public other;'
  + '   function check(bytes value) { require(this.data == value); }'
  + ' }';

/** A write beside a read of another value: the read value's chunks lead the run region and stay kept. */
const COPY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Pair {'
  + '   bytes public data;'
  + '   bytes public other;'
  + '   function copy() { this.other = this.data; }'
  + ' }';

const append = deployChunkRunContract(compileString(APPEND_SOURCE, { composition: 'framed' }), 'bytes append');
const set = deployChunkRunContract(compileString(SET_SOURCE, { composition: 'framed' }), 'bytes set');
const read = deployChunkRunContract(compileString(READ_SOURCE, { composition: 'framed' }), 'bytes read');
const copy = deployChunkRunContract(compileString(COPY_SOURCE, { composition: 'framed' }), 'bytes copy');

const BANG = new Uint8Array([0x21]);
const SHORT = distinctBytes(5, 0x11);
/** 120 bytes fill one chunk exactly, so one more byte needs a second. */
const FULL = distinctBytes(120, 0x13);
const LONG = distinctBytes(200, 0x17);
const chunk = (index: number, bytes: Uint8Array): Uint8Array => hexToBin(buildChunkCommitment(index, bytes));
const concat = (...parts: Uint8Array[]): Uint8Array => new Uint8Array(parts.flatMap((part) => [...part]));

const appendTo = (spent: Uint8Array, mutation: ChunkRunMutation = {}): ReturnType<typeof evaluateChunkRuns> =>
  evaluateChunkRuns(append, {
    runs: [{ variable: 'data', type: 'bytes', spent, written: concat(spent, BANG) }],
  }, mutation);

const setTo = (
  spent: Uint8Array, written: Uint8Array, mutation: ChunkRunMutation = {},
): ReturnType<typeof evaluateChunkRuns> =>
  evaluateChunkRuns(set, { args: [written], runs: [{ variable: 'data', type: 'bytes', spent, written }] }, mutation);

describe('a framed master whose state is bytes', () => {
  it('is emitted as a framed master for every shape below', () => {
    for (const contract of [append, set, read, copy]) {
      expect(contract.artifact.composition?.convention).toBe('framed');
      expect(contract.artifact.composition!.refusedEntries).toBeUndefined();
    }
    expect(append.artifact.stateLayout?.variables).toStrictEqual([
      { name: 'data', type: 'bytes', nftIndex: 0, fieldIndex: 0, dynamic: true },
    ]);
  });

  describe('an append, which reads the value and writes it one byte longer', () => {
    it('is accepted inside one chunk', () => {
      expect(appendTo(SHORT)).toStrictEqual({ accepted: true });
    });

    it('is accepted when it crosses into a second chunk, which the write creates', () => {
      expect(appendTo(FULL)).toStrictEqual({ accepted: true });
    });

    it('is accepted on an empty value, whose run the write creates from nothing', () => {
      expect(appendTo(new Uint8Array(0))).toStrictEqual({ accepted: true });
    });

    it('is refused when the segment does not declare the run', () => {
      expect(appendTo(SHORT, { undeclaredRun: true }).accepted).toBe(false);
    });

    it('is refused when the spent chunk is not the one the segment declares', () => {
      expect(appendTo(SHORT, { spentInputChunk: chunk(0, distinctBytes(5, 0x61)) }).accepted).toBe(false);
    });

    it('is refused when the written chunk is not the one the body computed', () => {
      expect(appendTo(SHORT, { writtenChunk: chunk(0, distinctBytes(6, 0x63)) }).accepted).toBe(false);
    });

    it('is refused when the written length header is not the one the body computed', () => {
      expect(appendTo(SHORT, { writtenHeader: lengthHeader(append, { data: SHORT.length }) }).accepted).toBe(false);
    });

    it('is refused when one more chunk is created past the run', () => {
      expect(appendTo(SHORT, { orphan: chunk(1, distinctBytes(4, 0x65)) }).accepted).toBe(false);
    });

    it('is refused when the spent chunk is declared created from a view no input carries', () => {
      // The value's real chunk stays unspent at the address, and the body appends to a view of the same length that
      // the declaration alone states; everything the transaction writes is what the body computes from that view.
      const forged = distinctBytes(SHORT.length, 0x67);
      expect(evaluateChunkRuns(append, {
        runs: [{ variable: 'data', type: 'bytes', spent: SHORT, written: concat(forged, BANG) }],
      }, { fabricatedSpentView: chunk(0, forged) }).accepted).toBe(false);
    });

    it('is refused when the spent chunk is not at the value\'s chunk address', () => {
      // The written chunk lands at the right address; only the input the old bytes are read from is elsewhere.
      expect(appendTo(SHORT, { spentInputLock: chunkLock(append, 'data', 'string') }).accepted).toBe(false);
    });
  });

  describe('an overwrite, which writes the value without reading it', () => {
    it('is accepted at the same width', () => {
      expect(setTo(SHORT, distinctBytes(9, 0x21))).toStrictEqual({ accepted: true });
    });

    it('is accepted when it grows the run from one chunk to two', () => {
      expect(setTo(SHORT, LONG)).toStrictEqual({ accepted: true });
    });

    it('is accepted when it shrinks the run from two chunks to one, consuming the second', () => {
      expect(setTo(LONG, SHORT)).toStrictEqual({ accepted: true });
    });

    it('is accepted when it empties the value, consuming its only chunk', () => {
      expect(setTo(SHORT, new Uint8Array(0))).toStrictEqual({ accepted: true });
    });

    it('is refused when a shrink leaves the chunk it drops unspent', () => {
      expect(setTo(LONG, SHORT, { leaveRemoved: true }).accepted).toBe(false);
    });

    it('is refused when a shrink writes the chunk it drops back at the address', () => {
      expect(setTo(LONG, SHORT, { keepRemoved: true }).accepted).toBe(false);
    });

    it('is refused when a chunk it consumes is not at the value\'s chunk address', () => {
      expect(setTo(LONG, SHORT, { spentInputLock: chunkLock(set, 'data', 'string') }).accepted).toBe(false);
    });

    it('is refused when emptying the value leaves its chunk unspent', () => {
      expect(setTo(SHORT, new Uint8Array(0), { leaveRemoved: true }).accepted).toBe(false);
    });

    it('is refused when one more chunk is created past the run', () => {
      expect(setTo(SHORT, distinctBytes(9, 0x21), { orphan: chunk(1, distinctBytes(4, 0x69)) }).accepted).toBe(false);
    });

    it('is refused when the written length header is not the one the body computed', () => {
      const wrong = lengthHeader(set, { data: SHORT.length });
      expect(setTo(SHORT, distinctBytes(9, 0x21), { writtenHeader: wrong }).accepted).toBe(false);
    });
  });

  describe('a read beside another value of the same record', () => {
    const DATA = distinctBytes(6, 0x31);
    const OTHER = distinctBytes(6, 0x37);
    const check = (value: Uint8Array, served: Uint8Array, mutation: ChunkRunMutation = {}): boolean =>
      evaluateChunkRuns(read, {
        args: [value],
        runs: [{ variable: 'data', type: 'bytes', spent: served, written: served }],
        untouched: { other: OTHER.length },
      }, mutation).accepted;

    it('is accepted when the value\'s own chunk serves it, kept in place', () => {
      expect(check(DATA, DATA)).toBe(true);
    });

    it('is refused when another value\'s chunk serves it', () => {
      // The other value's chunk has the same shape and the same category; only its address tells it apart.
      expect(check(OTHER, OTHER, { runLock: chunkLock(read, 'other', 'bytes') })).toBe(false);
    });

    it('is refused when the kept chunk is recreated away from the address', () => {
      expect(check(DATA, DATA, { keptOutputLock: distinctLock(0x71) })).toBe(false);
    });
  });

  describe('a write beside a read of another value', () => {
    const DATA = distinctBytes(7, 0x41);
    const copyFrom = (otherBefore: Uint8Array, mutation: ChunkRunMutation = {}): boolean =>
      evaluateChunkRuns(copy, {
        runs: [
          { variable: 'data', type: 'bytes', spent: DATA, written: DATA },
          { variable: 'other', type: 'bytes', spent: otherBefore, written: DATA },
        ],
      }, mutation).accepted;

    it('is accepted with the read value kept and the written one rewritten', () => {
      expect(copyFrom(distinctBytes(4, 0x45))).toBe(true);
    });

    it('is accepted when the written value shrinks from two chunks to one', () => {
      expect(copyFrom(distinctBytes(140, 0x47))).toBe(true);
    });

    it('is refused when the read value\'s chunk is rewritten', () => {
      expect(copyFrom(distinctBytes(4, 0x45), { writtenChunk: chunk(0, distinctBytes(9, 0x49)) })).toBe(false);
    });
  });
});
