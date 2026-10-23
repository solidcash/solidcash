import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  buildChunkCommitment, encodeInt, encodePushdataValue, packFixedWidthArray, type PrimitiveStateValue,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import {
  deployChunkRunContract, distinctBytes, distinctLock, evaluateChunkRuns, lengthHeader,
  type ChunkRunContract, type ChunkRunMutation,
} from './chunk-run-input.js';

/**
 * A framed master whose state is a dynamic array, settled on the BCH-2026 machine.
 *
 * An unbounded `T[]` state variable is chunk-packed: the data NFT carries the byte length of the array's encoding and
 * the encoding lives in a run of 120-byte chunk records at the array's own collection address. A fixed-width element
 * (`uint256`, `bytes32`) is packed at its width with no count; a variable-width one (`address`) is framed behind a
 * count push. A push, an element write and a pop each read the whole run and write it back, so they consume every
 * chunk the spent array holds and create every chunk the written one holds, and the frame holds its segment's run to
 * exactly that. Each shape is driven for the three element types; each refusal moves one fact of an accepted
 * transaction.
 */

interface ElementKind {
  readonly label: string;
  readonly type: string;
  readonly element: string;
  /** The array's encoding, as the body reads and writes it. */
  readonly encode: (values: readonly PrimitiveStateValue[]) => Uint8Array;
  /** The element as the entry's argument push carries it. */
  readonly argument: (value: PrimitiveStateValue) => Uint8Array;
  /** Distinct element values, as many as the shapes below need. */
  readonly values: readonly PrimitiveStateValue[];
  /** How many elements fill the first chunk: one more needs a second. */
  readonly perChunk: number;
}

const KINDS: readonly ElementKind[] = [
  {
    label: 'uint256',
    type: 'uint256[]',
    element: 'uint',
    encode: (values) => packFixedWidthArray([...values], 'uint256'),
    argument: (value) => encodeInt(value as bigint),
    values: [5n, 600n, 70_000n, 8_000_000n, 900_000_000n, 11n],
    perChunk: 3,
  },
  {
    label: 'address',
    type: 'address[]',
    element: 'address',
    encode: (values) => encodePushdataValue([...values], 'address[]'),
    argument: (value) => value as Uint8Array,
    values: [0x11, 0x23, 0x35, 0x47, 0x59, 0x6b].map((seed) => distinctLock(seed)),
    perChunk: 4,
  },
  {
    label: 'bytes32',
    type: 'bytes32[]',
    element: 'bytes32',
    encode: (values) => packFixedWidthArray([...values], 'bytes32'),
    argument: (value) => value as Uint8Array,
    values: [0x12, 0x24, 0x36, 0x48, 0x5a, 0x6c].map((seed) => distinctBytes(32, seed)),
    perChunk: 3,
  },
];

const source = (kind: ElementKind, entry: string): string => 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + `   ${kind.element}[] public items;`
  + `   ${entry}`
  + ' }';

const chunk = (index: number, bytes: Uint8Array): Uint8Array => hexToBin(buildChunkCommitment(index, bytes));

describe.each(KINDS)('a framed master whose state is $type', (kind) => {
  const deploy = (entry: string, label: string): ChunkRunContract =>
    deployChunkRunContract(compileString(source(kind, entry), { composition: 'framed' }), `${kind.label} ${label}`);
  const push = deploy(`function add(${kind.element} value) { this.items.push(value); }`, 'push');
  const put = deploy(`function put(uint index, ${kind.element} value) { this.items[index] = value; }`, 'put');
  const pop = deploy('function drop() { this.items.pop(); }', 'pop');
  // The length read names the array at a state access site, which is what marks the body as one whose head parks
  // the run's coordinate; `elementOnly` reads it through the element alone.
  const check = deploy(`function check(uint index, ${kind.element} value) {`
    + ' uint count = this.items.length; require(this.items[index] == value); require(count > index); }', 'check');
  const elementOnly = deploy(
    `function check(uint index, ${kind.element} value) { require(this.items[index] == value); }`, 'element only',
  );

  const [first, second, third, fourth, fifth, added] = kind.values;
  const held = (count: number): PrimitiveStateValue[] => kind.values.slice(0, count) as PrimitiveStateValue[];
  const full = held(kind.perChunk);
  const spill = held(kind.perChunk + 1);

  const run = (spent: readonly PrimitiveStateValue[], written: readonly PrimitiveStateValue[]): {
    variable: string; type: string; spent: Uint8Array; written: Uint8Array;
  } => ({
    variable: 'items',
    type: kind.type,
    spent: spent.length === 0 ? new Uint8Array(0) : kind.encode(spent),
    written: kind.encode(written),
  });
  const pushOnto = (
    spent: readonly PrimitiveStateValue[], mutation: ChunkRunMutation = {},
  ): ReturnType<typeof evaluateChunkRuns> =>
    evaluateChunkRuns(push, { args: [kind.argument(added!)], runs: [run(spent, [...spent, added!])] }, mutation);
  const popFrom = (
    spent: readonly PrimitiveStateValue[], mutation: ChunkRunMutation = {},
  ): ReturnType<typeof evaluateChunkRuns> =>
    evaluateChunkRuns(pop, { runs: [run(spent, spent.slice(0, -1))] }, mutation);
  const putAt = (index: number, written: readonly PrimitiveStateValue[]): ReturnType<typeof evaluateChunkRuns> =>
    evaluateChunkRuns(put, {
      args: [encodeInt(BigInt(index)), kind.argument(added!)],
      runs: [run([first!, second!], written)],
    });

  const readAt = (
    index: number, mutation: ChunkRunMutation = {}, contract: ChunkRunContract = check,
  ): ReturnType<typeof evaluateChunkRuns> =>
    evaluateChunkRuns(contract, {
      args: [encodeInt(BigInt(index)), kind.argument(kind.values[index]!)],
      runs: [run([first!, second!, third!], [first!, second!, third!])],
    }, mutation);

  it('is emitted as a chunk-packed framed master for every entry', () => {
    for (const contract of [push, put, pop, check, elementOnly]) {
      expect(contract.artifact.composition?.convention).toBe('framed');
      expect(contract.artifact.composition!.refusedEntries).toBeUndefined();
      expect(contract.artifact.stateLayout?.variables).toStrictEqual([
        { name: 'items', type: kind.type, nftIndex: 0, fieldIndex: 0, dynamic: true },
      ]);
    }
    // The shapes below cross a chunk boundary where the element count says they do.
    expect(kind.encode(full).length).toBeLessThanOrEqual(120);
    expect(kind.encode(spill).length).toBeGreaterThan(120);
  });

  it('accepts a push inside one chunk', () => {
    expect(pushOnto([first!, second!])).toStrictEqual({ accepted: true });
  });

  it('accepts a push that crosses into a second chunk, which the write creates', () => {
    expect(pushOnto(full)).toStrictEqual({ accepted: true });
  });

  it('accepts a push onto an empty array, whose run the write creates from nothing', () => {
    expect(pushOnto([])).toStrictEqual({ accepted: true });
  });

  it('accepts an element write inside the array', () => {
    expect(putAt(1, [first!, added!])).toStrictEqual({ accepted: true });
  });

  it('refuses an element write past the array\'s end', () => {
    expect(putAt(2, [first!, second!, added!]).accepted).toBe(false);
  });

  it('accepts a pop inside one chunk', () => {
    expect(popFrom([first!, second!, third!])).toStrictEqual({ accepted: true });
  });

  it('accepts a pop that drops the second chunk, consuming it', () => {
    expect(popFrom(spill)).toStrictEqual({ accepted: true });
  });

  it('refuses a pop of an empty array', () => {
    expect(evaluateChunkRuns(pop, { runs: [run([], [])] }).accepted).toBe(false);
  });

  it('refuses a push whose segment does not declare the run', () => {
    expect(pushOnto([first!, second!], { undeclaredRun: true }).accepted).toBe(false);
  });

  it('refuses a push whose written chunk is not the one the body computed', () => {
    const wrong = chunk(0, kind.encode([first!, second!, fourth!]));
    expect(pushOnto([first!, second!], { writtenChunk: wrong }).accepted).toBe(false);
  });

  it('refuses a push whose written length header is not the one the body computed', () => {
    const stale = lengthHeader(push, { items: kind.encode([first!, second!]).length });
    expect(pushOnto([first!, second!], { writtenHeader: stale }).accepted).toBe(false);
  });

  it('refuses a push that creates one more chunk past the run', () => {
    expect(pushOnto([first!, second!], { orphan: chunk(1, kind.encode([fifth!])) }).accepted).toBe(false);
  });

  it('refuses a pop that leaves the chunk it drops unspent', () => {
    expect(popFrom(spill, { leaveRemoved: true }).accepted).toBe(false);
  });

  it('refuses a pop that writes the chunk it drops back at the address', () => {
    expect(popFrom(spill, { keepRemoved: true }).accepted).toBe(false);
  });

  it('refuses a push whose spent chunk is not at the array\'s chunk address', () => {
    expect(pushOnto([first!, second!], { spentInputLock: distinctLock(0x73) }).accepted).toBe(false);
  });

  it('accepts an element read served by the array\'s own chunk, kept in place', () => {
    expect(readAt(2)).toStrictEqual({ accepted: true });
  });

  it('refuses an element read whose kept chunk is recreated away from the address', () => {
    expect(readAt(2, { keptOutputLock: distinctLock(0x75) }).accepted).toBe(false);
  });

  it('refuses an element read the body makes through the element alone: the head parks no run coordinate', () => {
    // Pinned wall: the framed shape assessment marks a body as touching dynamic state only at a state access site,
    // and an element read is not one, so the head parks no chunk-run coordinate for this body and its read lands
    // on the frame's data record. It fails closed; the same read beside a length read is accepted above.
    expect(readAt(2, {}, elementOnly).accepted).toBe(false);
  });
});
