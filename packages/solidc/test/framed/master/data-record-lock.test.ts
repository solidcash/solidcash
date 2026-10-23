import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { encodeIntegerValue } from '@solidcash/utils';
import {
  deployFramedMaster, evaluateMasterSpend, spent, type PlacedRecord,
} from './record-spend.js';

/**
 * A framed master holds its data record to the data-NFT covenant, on the input it spends and the output it writes.
 *
 * The master reads a record's fields from the record its segment declares and settlement ties them to the
 * commitments at the coordinate, but a commitment names no lock. Without this pin a UTXO of the same category with
 * the mutable pin, at any lock that merely preserves itself, would stand in for the data record: a plain UTXO the
 * frame does not own, or a mapping node or value chunk of the same contract whose commitment decodes as the record's
 * fields (T46). Every record lock is derived from the contract's category (spec 20), and the pin makes the UTXO the
 * frame treats as its state a genuine record.
 *
 * The whole shipped path runs: the source through `compileString` with the framed convention, the program through
 * `deployMaster`, and the BCH-2026 machine's verdict on the master's own input. A node covenant stands for the
 * node/chunk class, both of which sit at a category covenant that is not the data-NFT covenant.
 */

const PRAGMA = 'pragma solidcash ^0.14.0;';
const PLAIN = encodeLockingBytecodeP2sh32(hash256(new Uint8Array([1, 2, 3])));

describe('a read-only data record is held to the data-NFT covenant', () => {
  const master = deployFramedMaster(`${PRAGMA} contract Reader { uint n; mapping(address => uint) m;`
    + ' function checkN(uint x) { require(this.n == x); } }', 'data record lock reader');
  const record = master.record({ n: 5n });
  const nodeLock = master.collectionLock('m');
  const kept = (lock: Uint8Array): PlacedRecord => spent(lock, 2, record, record);

  it('is accepted when the record sits at the data-NFT covenant', () => {
    expect(evaluateMasterSpend(master, { args: [encodeIntegerValue(5n)], records: [kept(master.recordLock)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses the record at a plain lock the frame does not own', () => {
    expect(evaluateMasterSpend(master, { args: [encodeIntegerValue(5n)], records: [kept(PLAIN)] }).accepted)
      .toBe(false);
  });

  it('refuses a same-category mutable UTXO at a node or chunk covenant standing in for the record', () => {
    expect(evaluateMasterSpend(master, { args: [encodeIntegerValue(5n)], records: [kept(nodeLock)] }).accepted)
      .toBe(false);
  });

  it('still runs the body: a record whose field the require rejects is refused', () => {
    expect(evaluateMasterSpend(master, { args: [encodeIntegerValue(6n)], records: [kept(master.recordLock)] })
      .accepted).toBe(false);
  });
});

describe('a written data record is held to the data-NFT covenant on both sides', () => {
  const master = deployFramedMaster(`${PRAGMA} contract Writer { uint n; mapping(address => uint) m;`
    + ' function bump() { this.n = this.n + 1; } }', 'data record lock writer');
  const before = master.record({ n: 5n });
  const after = master.record({ n: 6n });
  const nodeLock = master.collectionLock('m');

  it('is accepted when both the spent record and the written output sit at the covenant', () => {
    expect(evaluateMasterSpend(master, { args: [], records: [spent(master.recordLock, 2, before, after)] }))
      .toStrictEqual({ accepted: true });
  });

  it('refuses the written output at a plain lock while the input sits at the covenant', () => {
    expect(evaluateMasterSpend(master, {
      args: [], records: [{ ...spent(master.recordLock, 2, before, after), writtenLock: PLAIN }],
    }).accepted).toBe(false);
  });

  it('refuses the spent record at a plain lock while the output sits at the covenant', () => {
    expect(evaluateMasterSpend(master, {
      args: [], records: [{ ...spent(PLAIN, 2, before, after), writtenLock: master.recordLock }],
    }).accepted).toBe(false);
  });

  it('refuses the written output at a node or chunk covenant of the same contract', () => {
    expect(evaluateMasterSpend(master, {
      args: [], records: [{ ...spent(master.recordLock, 2, before, after), writtenLock: nodeLock }],
    }).accepted).toBe(false);
  });
});
